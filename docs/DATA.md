# vPIC data pipeline

The decoder runs entirely on NHTSA's official **vPICList_lite** database dump
(`https://vpic.nhtsa.dot.gov/downloads/`, public domain). Nothing is fetched from
NHTSA at decode time.

```
NHTSA monthly dump (.plain.zip, ~76 MB)
        │  scripts/vpic/ingest-dump.ts        (weekly, GitHub Actions)
        ▼
data/vpic/*.tsv  + manifest.json               ← git-tracked source of truth
        │  scripts/vpic/build-assets.ts       (every build/deploy)
        ▼
build/assets/vpic/**.json  (~5.3k files)       ← Workers Static Assets (ASSETS binding)
        │  src/vpic/*                          (port of vpic.spVinDecode)
        ▼
/api/v1/vin/:vin, /vehicles/DecodeVinValues/:vin, ...
```

## data/vpic (git)

| Path | Content |
| :-- | :-- |
| `manifest.json` | dump version, source URL, row counts and SHA-256 of every file |
| `pattern/00..15.tsv` | `vpic.Pattern` (1.68 M rows), sharded by VIN schema id |
| `wmiyearvalidchars/00..07.tsv` | `vpic.WMIYearValidChars` (8.8 M rows) aggregated per (WMI, year) |
| `wmi.tsv`, `wmi_vinschema.tsv`, `vinschema.tsv`, ... | every other table/column the decoder reads |
| lookup tables (`make.tsv`, `bodystyle.tsv`, ...) | `id` + `name` of each lookup the decoder resolves |

Files are sorted and written in PostgreSQL `COPY` text encoding, so ingesting the
same dump twice produces byte-identical files and a new dump is a readable diff.
Columns are listed in `scripts/vpic/lib/tables.ts`.

## Weekly refresh (`.github/workflows/vpic-data.yml`)

Runs every Monday 06:17 UTC, on manual dispatch (optionally with a dump name), and
on pushes that change the decoder or pipeline.

1. **Ingest** the newest dump listed on the downloads page into `data/vpic`.
2. **Build** the static assets.
3. **Parity gate**: decode 1,000 VINs offline and compare every field with the live
   `DecodeVINValuesBatch` API. The run fails (nothing is committed or deployed) when
   the share of VINs identical on every field is below `VPIC_PARITY_MIN`
   (repository variable, default `0.85`).
4. **Typecheck and tests** against the new data, including the golden test.
5. **Commit** `data/vpic` and `test/fixtures/vpic-golden.json` in **one commit**
   (`data(vpic): <dump> (live parity NN.NN%)`).
6. **Deploy** the `nhtsa-edge-api-dev` worker and smoke-test it (health reports the
   new data version; a known VIN decodes).

The workflow pushes with the default `GITHUB_TOKEN`. If the branch it runs on is
protected, allow GitHub Actions to push to it (or change the commit step to open a pull
request instead).

### Reverting a data update

Each update is one commit containing both the data and the matching expectations:

```bash
git revert <data commit>   # restores the previous data/vpic and golden fixture
git push                   # the workflow redeploys the dev worker with the old data
```

`wrangler rollback` also works for an immediate rollback of a deployed version,
because data (assets) and code are deployed together as one version.

## Parity with the live API

`scripts/vpic/parity.ts` builds a deterministic corpus (seeded) of:

- real VINs from `vpic.VinException`,
- VINs assembled from real Model patterns of randomly chosen WMI/schema links
  (weighted towards manufacturers with many schemas) with a valid check digit,
- error paths: wrong check digit, 11-character descriptors, invalid characters,
  mutated VDS, caller-supplied model years.

It reports the exact-match rate, a letter-case-insensitive rate, per-field
mismatches with examples, and a model-year breakdown (`build/parity/`, uploaded as
a workflow artifact).

Remaining differences come mainly from **data freshness**: the live database keeps
changing between monthly dumps (new patterns, re-cased names such as
`C-max` → `C-Max`). These differences shrink when the next dump is ingested.

## Verification against the reference SQL functions

Parity with the live API cannot tell a porting bug from newer live data. So the port is
also compared with the verbatim NHTSA functions running in PostgreSQL on **the same
data**, where any difference comes from the code (`scripts/vpic/sql-verify/`):

```bash
# PostgreSQL (17+ for the original dump) and psql on PATH; libpq variables select the database
export PGHOST=localhost PGPORT=5433 PGUSER=postgres PGDATABASE=postgres
pnpm build:data
bun scripts/vpic/sql-verify/load-db.ts                 # data/vpic + decode-functions.sql, ~40 s
bun scripts/vpic/sql-verify/compare.ts --size=10000    # full decode, field by field
bun scripts/vpic/sql-verify/functions.ts               # each ported helper vs its SQL function
```

`load-db.ts` rebuilds the tables from `data/vpic` (`createdon` = `changedon`, since every
query reads `coalesce(UpdatedOn, CreatedOn)`; `WMIYearValidChars` expanded from its
aggregate) and loads `decode-functions.sql` unchanged. By default it adds a sentinel row
for (WMI, year) pairs missing from `WMIYearValidChars`, so the PostgreSQL fallback is
skipped as the live API does (next section); `--pg-fallback` keeps it, and `compare.ts`
then reports exactly those VINs (a useful negative control).

Result on `vPICList_lite_2026_09`:

| Check | Inputs | Differences |
| :-- | --: | --: |
| `spvindecode`, every element (seeds 1 and 7) | 11,000 VINs | 0, apart from conversion rounding (`DisplacementCI`/`DisplacementL`, numerically equal to 1e-6) |
| `fvinwmi`, `fvindescriptor`, `fvincheckdigit`, `fvincheckdigit2`, `fvinmodelyear2` | 4,642 strings (VINs, lower case, truncated, padded, 6-char WMIs) | 0 |
| `sqlwild_to_regex`, `fvalidcharsinkey` | 60,639 distinct pattern keys | 0 |
| Pattern key match (`LIKE` / regex of `spvindecode_core`) | 3,842,143 VIN × key pairs (55,146 matching) | 0 |
| `felementattributevalue` | 126,137 (element, attribute) pairs shipped in the assets | 0 |
| Negative control (`--pg-fallback`) | 1,000 VINs | 22, all error codes 5 vs 0 as expected |

The weekly workflow repeats this on the **original dump**, restored unchanged in
PostgreSQL 17 (`load-db.ts --dump=<zip>`): `projection.ts` proves every table in
`data/vpic` equals the dump's rows, then `compare.ts` (3,000 VINs) and `functions.ts`
run against the dump's own functions and data. Any difference blocks the data commit.
`scripts/vpic/errata/audit.ts` then lists defects of the dump and checks them against the
live API (informational) — see [NHTSA-ERRATA.md](NHTSA-ERRATA.md).

## Where the port follows the live API instead of the dump's PostgreSQL code

The dump ships a PostgreSQL port of NHTSA's SQL Server decoder
(`docs/vpic-reference/decode-functions.sql`). The live API runs on SQL Server, and
parity showed four behaviours where the two differ; the live behaviour is used:

| Topic | PostgreSQL port (dump) | Live API (implemented) |
| :-- | :-- | :-- |
| Unit conversions | `numeric` scale rules (`2.4/0.016387064 = 146.4569858273574815`) | SQL Server `decimal` typing, truncated (`146.45698582735`) — `src/vpic/tsql-decimal.ts` |
| Position checks (codes 2-5) | recomputes valid characters when `WMIYearValidChars` lacks the (WMI, year) | uses `WMIYearValidChars` only |
| Multi-value elements | insertion order | joined with `", "` (see known limitations) |
| `VinDescriptor` model-year overrides | never applied (erratum E1) | applied — [NHTSA-ERRATA.md](NHTSA-ERRATA.md) |

Everything else follows the dump's functions step by step.

## Known limitations

- **WMIYearValidChars freshness.** NHTSA regenerates this table per WMI at different
  times. Parity found WMIs whose live rows were regenerated after the dump (the live
  API then lists fewer possible characters) next to WMIs whose live rows still equal the
  dump's. The dump's rows are used as they are; the difference only affects the error
  codes 2-5 and `PossibleValues`/`SuggestedVIN` of VINs with invalid characters.
- **Order of multi-value elements** (`Note`, `OtherEngineInfo`, `OtherTrailerInfo`, ...).
  The live API returns the values in an order no deterministic rule over the dump
  reproduces (SQL Server returns them without an `ORDER BY`); the set of values matches.
- **Data freshness.** The live database changes daily; values added or re-cased after
  the dump was published appear only after the next ingest.

## Updating the reference functions

If NHTSA changes the decode functions, re-extract them from a new dump and compare:

```bash
unzip -p vPICList_lite_YYYY_MM.plain.zip '*.sql' | sed -n '/^CREATE FUNCTION vpic.felementattributevalue/,/^SET default_tablespace/p'
```

Replace `docs/vpic-reference/decode-functions.sql` and port the differences into
`src/vpic/`; the parity gate shows whether the change matters.
