# Dataset maintenance

The worker bundles two JSON files extracted from an official NHTSA vPIC dump:

| File | Shape | Used by |
| :-- | :-- | :-- |
| `data/wmi-master.json` | `{ "<WMI>": { "make", "country", "vehicleType" } }` | `/vin/:vin/local`, `/compare` |
| `data/makes-models.json` | `{ "<MAKE UPPERCASE>": ["Model", ...] }` | `/makes`, `/models` |
| `data/sync-metadata.json` | dump version, counts, last check | informational, CI |

`migrations/0002_seed_official_wmi.sql` seeds the same WMIs into D1 and is generated from
`wmi-master.json`.

## What is automated

`nhtsa-sql-sync.yml` (Sunday and Monday, 03:00 UTC):

- **Detects** a monthly dump newer than `activeDumpVersion` and records it as `latestAvailableDump`.
  The job summary shows an "Action needed" note.
- **Adds** newly registered models for the top makes (`scripts/lib/catalog.ts` → `TOP_MAKES`) from
  the live API. Models are never removed, because a partial API answer must not shrink the catalog.
- Commits and deploys **only** when a data file changed.

To refresh one make by hand: `bun scripts/sync-from-api.ts --make=Rivian`.

## What is manual: ingesting a new monthly dump

WMIs change only through a dump ingestion. Treat it as a reviewed change (open a PR and check the diff).

1. **Download** the dump named in the job summary:

   ```bash
   bash scripts/download-vpic-dump.sh ./nhtsa-dumps vPICList_lite_YYYY_MM
   unzip ./nhtsa-dumps/vPICList_lite_YYYY_MM.plain.zip -d ./nhtsa-dumps
   ```

2. **Restore** it into a throwaway PostgreSQL instance:

   ```bash
   docker run -d --name vpic -e POSTGRES_PASSWORD=vpic -p 5432:5432 postgres:16
   psql -h localhost -U postgres -f ./nhtsa-dumps/vPICList_lite_*.sql
   ```

3. **Export** the WMI and model tables to JSON. The queries below are a starting point: check table
   and column names against the restored `vpic` schema (`\dt vpic.*`), because NHTSA occasionally
   changes them.

   ```sql
   -- WMI -> make, country, vehicle type
   SELECT w.wmi, m.name AS make, c.name AS country, vt.name AS vehicle_type
   FROM vpic.wmi w
   LEFT JOIN vpic.wmi_make wm ON wm.wmiid = w.id
   LEFT JOIN vpic.make m      ON m.id = wm.makeid
   LEFT JOIN vpic.country c   ON c.id = w.countryid
   LEFT JOIN vpic.vehicletype vt ON vt.id = w.vehicletypeid;

   -- make -> models
   SELECT upper(m.name) AS make, mo.name AS model
   FROM vpic.make_model mm
   JOIN vpic.make m   ON m.id = mm.makeid
   JOIN vpic.model mo ON mo.id = mm.modelid;
   ```

   Write the results in the shapes shown at the top of this file (2-space indented JSON, keys in a
   stable order, so the diff stays reviewable).

4. **Regenerate** the D1 seed and update the metadata:

   ```bash
   bun scripts/generate-d1-seed.ts
   # in data/sync-metadata.json: set activeDumpVersion to the new dump name
   ```

5. **Verify** and open a PR:

   ```bash
   pnpm typecheck && pnpm test && pnpm build   # build reports the bundle size
   ```

   Existing D1 databases pick up new WMIs only for rows that do not exist yet (`INSERT OR IGNORE`).
   For a full refresh, add a new migration instead of editing `0002`, because applied migrations
   never run again.

## Improvement worth making

Steps 2–4 are a good candidate for a script (`scripts/ingest-dump.ts`) that reads the plain SQL
dump's `COPY` blocks directly, with no PostgreSQL needed, and writes both JSON files. That would let
the scheduled workflow open an ingestion PR by itself.
