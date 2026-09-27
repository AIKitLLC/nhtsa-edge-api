# NHTSA Edge API

A **Cloudflare Workers** gateway in front of the NHTSA vehicle APIs
([vPIC](https://vpic.nhtsa.dot.gov/api/) and [Recalls](https://api.nhtsa.gov/)). It adds:

- **Edge caching**: VIN decodes are cached for 30 days, catalogs for 7 days, recalls for 6 hours.
- **A clean v1 JSON API**: typed numbers and booleans, empty VPIC fields removed.
- **A drop-in VPIC proxy**: same paths as `vpic.nhtsa.dot.gov/api/vehicles/*`, plus optional `clean=true`.
- **An in-memory VIN engine** (49 CFR Part 565): check digit, model year and WMI lookup against a bundled
  NHTSA catalog of 13,001 WMIs and 32,009 models. No network call.
- **A parity audit endpoint** that compares the local engine with live NHTSA output.

> **Scope of the local engine.** It returns the WMI make and manufacturer, model year, country, vehicle
> type and check-digit validity. It does **not** return model, trim, engine or body. For those, use
> `/api/v1/vin/:vin`, which calls NHTSA and caches the result.

---

## Quickstart

Requires Node.js >= 18 and pnpm (`corepack enable`).

```bash
git clone https://github.com/AIKitLLC/nhtsa-edge-api.git
cd nhtsa-edge-api
pnpm install

pnpm db:migrate:local           # create the local D1 database
echo "ADMIN_TOKEN=dev-token" > .dev.vars
pnpm dev                        # http://localhost:8787
```

```bash
pnpm typecheck   # worker + scripts, strict TypeScript
pnpm test        # vitest unit & integration tests
pnpm build       # dry-run bundle (checks the worker size)
```

---

## API

### v1 REST API

| Method | Endpoint | Description | Upstream | Cache |
| :-- | :-- | :-- | :-- | :-- |
| `GET` | `/api/v1/vin/:vin` | Compact VIN decode (full or wildcard VIN, 3–17 chars) | VPIC | 30 days |
| `GET` | `/api/v1/vin/:vin/local` | In-memory decode, enriched from D1 when bound | none | – |
| `GET` | `/api/v1/vin/:vin/compare` | Local engine vs. live VPIC parity report | VPIC | never |
| `GET` | `/api/v1/makes[?remote=true]` | All makes (bundled catalog; `remote=true` → VPIC) | optional | 7 days |
| `GET` | `/api/v1/models?make=:make[&remote=true]` | Models for a make: bundled catalog → D1 → VPIC | fallback | 7 days |
| `GET` | `/api/v1/recalls/:vin` | Recall campaigns for a full 17-char VIN | Recalls API | 6 hours |
| `GET` | `/api/v1/sync/status` | D1 statistics and the last 20 sync runs | none | – |

Every response carries `X-Cache-Status` (`HIT`/`MISS`), `X-Cache-Tier`, `X-Response-Time-Ms` and
`Server-Timing`. Errors use one envelope:

```json
{ "success": false, "error": { "code": "INVALID_VIN_FORMAT", "message": "..." }, "timestamp": "..." }
```

<details>
<summary>Sample <code>GET /api/v1/vin/5UXWX7C5*BA</code></summary>

```json
{
  "success": true,
  "data": {
    "vin": "5UXWX7C5*BA",
    "make": "BMW",
    "model": "X3",
    "year": 2011,
    "trim": "xDrive35i",
    "vehicleType": "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
    "bodyClass": "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
    "doors": 4,
    "driveType": "AWD/All-Wheel Drive",
    "engineCylinders": 6,
    "displacementL": 3,
    "engineHp": 300,
    "fuelType": "Gasoline",
    "plantCountry": "GERMANY",
    "manufacturer": "BMW NORTH AMERICA",
    "isValidVin": true,
    "errorCode": "0",
    "extraAttributes": { "TPMS": "Direct" }
  },
  "source": "UPSTREAM",
  "cached": false,
  "timestamp": "2026-09-27T03:40:18.535Z"
}
```
</details>

### Drop-in VPIC proxy

Point an existing VPIC integration at the worker. Both `/vehicles/*` and `/api/vehicles/*` work:

```
GET /vehicles/DecodeVinValues/:vin?format=json
GET /vehicles/GetModelsForMake/:make?format=json
GET /vehicles/GetAllMakes?format=json&clean=true   # strip empty fields
```

`format=json` is added when missing. Only these query parameters are forwarded and cached:
`format, modelyear, year, make, model, units, page, vehicleType, manufacturer`. Other parameters
are dropped, so they cannot be used to bypass the cache. The proxy accepts GET (and HEAD) only.

### Recalls proxy

`GET /recalls/*` is proxied to `https://api.nhtsa.gov/recalls/*` and cached for 6 hours
(forwarded parameters: `make, model, modelYear, campaignNumber, vin`).

> The `/api/v1/recalls/:vin` endpoint calls `recalls/recallsByVin`. Check that this endpoint is
> available on the public NHTSA API before relying on it. The documented public endpoints are
> `recallsByVehicle` and `campaignNumber`.

### Admin endpoints (require `Authorization: Bearer <ADMIN_TOKEN>`)

| Method | Endpoint | Description |
| :-- | :-- | :-- |
| `POST` | `/api/v1/sync/makes` | Refresh all makes into D1 |
| `POST` | `/api/v1/sync/models?make=:make` | Refresh models of one make into D1 |
| `POST` | `/api/v1/sync/wmi?wmi=:wmi` | Fetch one WMI from VPIC into D1 |
| `POST` | `/api/v1/sync/incremental` | Refresh models of the top makes (also runs daily by cron) |
| `POST` | `/api/v1/admin/seed` | Seed the built-in top-manufacturer WMIs |

If `ADMIN_TOKEN` is not configured, these endpoints return `503 ADMIN_DISABLED`.

---

## Caching: read this before deploying

| Tier | Where | Notes |
| :-- | :-- | :-- |
| L1 `caches.default` | per Cloudflare data center | **Has no effect on `*.workers.dev`.** Needs a custom domain or route on a zone you own. |
| L2 KV (optional) | global | Set `ENABLE_KV_CACHE=true` and bind `NHTSA_CACHE_KV`. |
| In-flight coalescing | per isolate | Concurrent identical upstream requests share one fetch. |

On a bare `*.workers.dev` deployment with KV disabled, **every request goes to NHTSA**. For caching
to work in production, attach a custom domain (Workers → your worker → Settings → Domains & Routes),
enable KV, or do both.

Cache keys are built from normalized input (uppercase VIN, allow-listed parameters in sorted order),
so `?x=1` or a lowercase VIN does not create a new cache entry.

Upstream calls time out after `UPSTREAM_TIMEOUT_MS` (default 5000 ms). Only 502, 503 and 504
responses are retried, up to 2 times with exponential backoff.

---

## Deploying to Cloudflare

### Automated

```bash
pnpm setup:cloudflare
```

The script logs you in, creates or reuses the `nhtsa-db` D1 database, writes its id into
`wrangler.jsonc`, applies migrations, deploys the worker, and creates an `ADMIN_TOKEN` secret.
The token is printed once, so save it.

**Commit the updated `wrangler.jsonc` afterwards.** The database id is not a secret, and CI deploys
fail until the placeholder `local-nhtsa-db` is replaced.

### Manual

```bash
npx wrangler login
npx wrangler d1 create nhtsa-db          # copy database_id into wrangler.jsonc, then commit it
pnpm db:migrate:remote
npx wrangler secret put ADMIN_TOKEN      # e.g. output of: openssl rand -hex 32
pnpm deploy
```

Optional KV cache:

```bash
npx wrangler kv namespace create NHTSA_CACHE_KV
# uncomment kv_namespaces in wrangler.jsonc, paste the id, set "ENABLE_KV_CACHE": "true"
```

### Configuration

| Name | Kind | Default | Purpose |
| :-- | :-- | :-- | :-- |
| `ADMIN_TOKEN` | secret | unset (admin disabled) | Bearer token for sync/admin endpoints |
| `UPSTREAM_TIMEOUT_MS` | var | `5000` | Timeout per upstream attempt |
| `ENABLE_KV_CACHE` | var | `false` | Enable the L2 KV cache |
| `ENVIRONMENT` | var | `production` | Informational |
| `DB` | D1 binding | – | VIN store, WMI catalog, sync history, parity audits |
| `NHTSA_CACHE_KV` | KV binding | – | Optional L2 cache |

---

## Data & automation

| Source | Content | How it is refreshed |
| :-- | :-- | :-- |
| `data/wmi-master.json` | 13,001 WMIs (bundled in the worker) | Manual ingestion of a monthly vPIC dump. See [docs/DATA.md](docs/DATA.md). |
| `data/makes-models.json` | 32,009 models (bundled) | GitHub Action (new models for the top makes, merge only) |
| `migrations/0002_seed_official_wmi.sql` | Same WMIs, seeded into D1 | `bun scripts/generate-d1-seed.ts` after changing `wmi-master.json` |
| D1 `makes_models`, `makes`, `wmi_catalog` | Live API additions | Worker cron (daily 03:00 UTC) and admin sync endpoints |

**Workflows**

- `ci.yml` runs on every push and PR: typecheck, tests, and a dry-run bundle.
- `nhtsa-sql-sync.yml` runs Sunday and Monday at 03:00 UTC, or on demand:
  1. It checks whether NHTSA has published a monthly dump newer than the bundled one. If so, it flags
     this in the job summary (ingesting a dump is a manual, reviewed step).
  2. It adds newly registered models for the top makes. Models are never removed.
  3. When data changed and `CLOUDFLARE_API_TOKEN` is set, it commits the data, applies D1 migrations,
     and deploys. When nothing changed, it does not commit or deploy.

Add the `CLOUDFLARE_API_TOKEN` repository secret (Settings → Secrets and variables → Actions) to
enable automatic deploys. The token needs Workers Scripts:Edit and D1:Edit permissions.

---

## Project structure

```
src/
  index.ts                  app wiring, admin guard, cron handler
  config.ts                 upstream URLs, TTLs, header names
  middleware/               cors, timing, error boundary, admin-auth
  routes/
    health.ts               GET /
    v1/                     vin.ts, catalog.ts, recalls.ts, admin.ts
    sync.ts                 /api/v1/sync/*
    vpic-proxy.ts           /vehicles/*, /api/vehicles/*
    recalls-proxy.ts        /recalls/*
  services/
    cached-upstream.ts      the one read-through cache flow used by every cached route
    cache.ts                L1/L2 cache + canonical cache keys
    upstream.ts             fetch with timeout, retry, coalescing
    local-decoder.ts        49 CFR 565 check digit / model year / WMI
    local-enrichment.ts     local decode + D1 enrichment
    vin-upstream.ts         VPIC DecodeVinValues → compact spec
    comparator.ts           parity audit
    d1-database.ts          D1 queries
    api-syncer.ts           live API → D1 sync
  validation/vin.ts         zod VIN schemas
scripts/                    setup, data sync, benchmarks (typechecked with scripts/tsconfig.json)
migrations/                 D1 schema and seed
test/                       vitest suites
```

---

## Known limitations

- The local engine decodes the WMI (positions 1–3, or 1–3 + 12–14 for low-volume makers), the model
  year and the check digit. The VDS (model, engine, body) needs NHTSA's pattern tables and is not
  implemented.
- The model-year rule based on position 7 applies to light vehicles for the North American market.
  For other VINs, the engine picks the most recent cycle that is not in the future.
- The check digit is mandatory only for VINs from the North American market. European VINs often fail
  it legitimately.
- The bundled catalog adds about 525 KiB (gzip) to the worker. This is within the 3 MB free-plan limit
  but should be watched as the dataset grows.

---

## Legal

- vPIC data is a work of the U.S. Government and is in the public domain (17 U.S.C. § 105).
- The data contains vehicle specifications only, with no personal or registration data.
- Data source: National Highway Traffic Safety Administration (NHTSA), U.S. DOT. This project is
  independent and not affiliated with or endorsed by NHTSA.

## License

[MIT](LICENSE)
