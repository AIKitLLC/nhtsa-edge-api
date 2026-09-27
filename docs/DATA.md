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

## Where the port follows the live API instead of the dump's PostgreSQL code

The dump ships a PostgreSQL port of NHTSA's SQL Server decoder
(`docs/vpic-reference/decode-functions.sql`). The live API runs on SQL Server, and
parity showed three behaviours where the two differ; the live behaviour is used:

| Topic | PostgreSQL port (dump) | Live API (implemented) |
| :-- | :-- | :-- |
| Unit conversions | `numeric` scale rules (`2.4/0.016387064 = 146.4569858273574815`) | SQL Server `decimal` typing, truncated (`146.45698582735`) — `src/vpic/tsql-decimal.ts` |
| Position checks (codes 2-5) | recomputes valid characters when `WMIYearValidChars` lacks the (WMI, year) | uses `WMIYearValidChars` only |
| Multi-value elements | insertion order | joined with `", "` (see known limitations) |

Everything else follows the dump's functions step by step, including behaviours that
look like bugs but determine the output (for example, `spvindecode` computes the VIN
descriptor before the VIN variable is assigned, so the `VinDescriptor` pass never runs).

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
