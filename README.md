# NHTSA Edge API

An **offline VIN decoder** for the NHTSA vPIC database, running on **Cloudflare Workers**.

- Decodes full and partial VINs **without calling NHTSA**: a TypeScript port of vPIC's
  own `spVinDecode` runs over the official monthly vPIC dump, bundled with the worker as
  static assets. Median decode time is a few milliseconds.
- **Drop-in compatible** with `vpic.nhtsa.dot.gov/api`: `DecodeVinValues`, `DecodeVin`
  and `DecodeVINValuesBatch` return the same JSON shape; all other vPIC endpoints and the
  recalls API are proxied and cached.
- **Verified against the live API**: every data update is gated by a field-by-field
  comparison of 1,000 VINs with the live vPIC API (see [Accuracy](#accuracy)).
- **Verified against NHTSA's own SQL**: the dump is restored unchanged in PostgreSQL and
  its decode functions are compared with the port on every data update; defects found in
  the dump are documented and, where the live API shows the right answer, fixed
  ([NHTSA errata](docs/NHTSA-ERRATA.md)).
- **Weekly data updates committed to git**: data and its expected results change in one
  commit, so an update can be reviewed and reverted like code.

---

## Endpoints

### Offline decoding

| Method | Endpoint | Response |
| :-- | :-- | :-- |
| `GET` | `/api/v1/vin/:vin[?modelyear=YYYY]` | Clean JSON: typed headline fields + every decoded attribute |
| `GET` | `/vehicles/DecodeVinValues/:vin?format=json[&modelyear=YYYY][&clean=true]` | vPIC `DecodeVinValues` (flat) |
| `GET` | `/vehicles/DecodeVin/:vin?format=json[&clean=true]` | vPIC `DecodeVin` (one row per variable) |
| `POST` | `/vehicles/DecodeVINValuesBatch/` (form: `format=json`, `data=VIN[,year];…`, max 50) | vPIC batch |
| `GET` | `/api/v1/makes` | All makes (`vpic.Make`) |
| `GET` | `/api/v1/models?make=:make` | Models of a make (`vpic.Make_Model`) |

`/api/vehicles/...` works as well as `/vehicles/...`, and paths are case-insensitive like
vPIC's. VINs may be partial (3–17 characters) and may contain `*` wildcards.
`clean=true` (or `compact=true`) drops empty and `Not Applicable` values.

Offline responses carry `X-Decode-Source: LOCAL_VPIC` and `X-Vpic-Data-Version`
(e.g. `vPICList_lite_2026_09`) and are cacheable (`Cache-Control: public, max-age=86400`).

<details>
<summary>Sample <code>GET /api/v1/vin/1HGCM82633A004352</code></summary>

```json
{
  "success": true,
  "data": {
    "vin": "1HGCM82633A004352",
    "make": "HONDA",
    "makeId": 474,
    "model": "Accord",
    "modelId": 1861,
    "modelYear": 2003,
    "trim": "EX-V6",
    "series": null,
    "manufacturer": "AMERICAN HONDA MOTOR CO., INC.",
    "manufacturerId": 988,
    "vehicleType": "PASSENGER CAR",
    "bodyClass": "Coupe",
    "doors": 2,
    "driveType": null,
    "engineCylinders": 6,
    "displacementL": 2.998832712,
    "engineHp": 240,
    "fuelType": "Gasoline",
    "electrificationLevel": null,
    "plantCountry": "UNITED STATES (USA)",
    "plantState": "OHIO",
    "plantCity": "MARYSVILLE",
    "errorCodes": [0],
    "errorText": "0 - VIN decoded clean. Check Digit (9th position) is correct",
    "isCleanDecode": true,
    "suggestedVin": null,
    "attributes": { "DisplacementCC": "2998.832712", "EngineModel": "J30A4", "...": "..." }
  },
  "source": "LOCAL_VPIC",
  "dataVersion": "vPICList_lite_2026_09",
  "decodeMs": 2.11,
  "timestamp": "2026-09-27T14:15:15.323Z"
}
```
</details>

### Other

| Method | Endpoint | Notes |
| :-- | :-- | :-- |
| `GET` | `/` | Health JSON: `status`, `dataVersion` (503 if the data assets are unreadable); browsers get a landing page |
| `GET` | `/api/v1/vin/:vin/unified[?epa=false&eu=false]` | Offline decode + US EPA FuelEconomy.gov (EV range, MPGe, motor) + EU RDW (type approval, masses). Enrichments are model-level, not VIN-specific; a failed enrichment leaves its section `null` and the response uncached |
| `GET` | `/api/v1/vin/:vin/compare` | Offline decode vs live vPIC, field by field (not cached) |
| `GET` | `/api/v1/recalls/:vin` | Recalls for a 17-character VIN (proxied to `api.nhtsa.gov`, cached 6 h) |
| `GET` | `/vehicles/*` | Any other vPIC endpoint, including `*Extended` decodes (proxied, cached) |
| `GET` | `/recalls/*` | Recalls API drop-in proxy (cached) |

Proxied endpoints forward only known query parameters, so extra parameters cannot bypass
the cache. The Cache API is a no-op on `*.workers.dev`; attach a custom domain (or enable
the optional KV cache) for caching of proxied responses. Offline decoding does not
depend on it.

---

## Accuracy

`scripts/vpic/parity.ts` decodes a deterministic set of 1,000 VINs (real VINs from the
dump, VINs built from real model patterns, and error cases) and compares **every field**
with the live `DecodeVINValuesBatch` API. The weekly workflow fails, and nothing is
committed or deployed, when the share of fully identical VINs drops below the
`VPIC_PARITY_MIN` threshold (default 85%).

The latest report is in the job summary of the `vPIC data refresh & dev deploy` workflow,
and its parity rate is part of each data commit message. Most remaining differences
are NHTSA data changes made after the dump was published (new patterns, re-cased names);
they disappear with the next dump. Details: [docs/DATA.md](docs/DATA.md).

### Performance

Measured on 3,000 varied VINs (the parity corpus) with the production cache settings:

| Metric | Value |
| :-- | :-- |
| Decode time p50 / p95 / p99 (including cold asset reads) | 1.4 ms / 6.2 ms / 10.9 ms |
| Decode time, warm (asset already cached in the isolate) | ~1–3 ms |
| Peak heap of the per-isolate data cache (4 MB JSON budget, LRU) | ~42 MB |
| Worker script size | ~61 KB gzip (data ships as static assets) |

---

## Development

Requirements: Node.js ≥ 18, pnpm, and [Bun](https://bun.sh) for the data scripts.

```bash
pnpm install
pnpm build:data      # data/vpic -> build/assets (≈15 s)
pnpm dev             # http://localhost:8787
pnpm typecheck       # worker + scripts
pnpm test            # unit + route tests on the real data, golden test vs recorded live results
pnpm parity -- --size=200   # compare with the live API (needs internet)
```

Project layout:

```
src/
  vpic/                 port of vpic.spVinDecode (one file per source function/step)
    decode.ts           spvindecode: model-year passes, best pass, final values
    decode-core.ts      spvindecode_core: one pass
    decode-errors.ts    spvindecode_errorcode
    keys.ts             pattern keys (LIKE / regex / valid characters)
    vin-functions.ts    WMI, descriptor, check digit, model year
    vehicle-spec.ts     vehicle spec step
    conversions.ts      unit conversions, evaluated with tsql-decimal.ts
    store.ts            asset access (+ worker-store.ts for the ASSETS binding)
    format.ts           vPIC response shapes; v1-format.ts: clean v1 shape
  routes/               v1 API, vPIC drop-in (vpic-decode.ts offline, vpic-proxy.ts), recalls
  services/             upstream fetch, cache, multi-source resolver, response helpers
  enrichment/           US EPA FuelEconomy.gov and EU RDW lookups for /unified
scripts/vpic/           ingest-dump.ts, build-assets.ts, parity.ts (+ lib/)
data/vpic/              the vPIC tables used by the decoder (git-tracked)
docs/vpic-reference/    NHTSA's decode functions, verbatim, as the porting reference
```

---

## Deployment

The worker and its data deploy together (`assets` in `wrangler.jsonc`), so every
deployment is one immutable version that `wrangler rollback` can restore.

**Plan:** use **Workers Paid** for production. The free plan limits a request to 10 ms
of CPU; a cold decode that parses a large data file, or a 50-VIN batch, can exceed it.
Static assets (≈5.3k files) fit the free plan's 20,000-file limit either way.

### Dev worker (automatic)

`.github/workflows/vpic-data.yml` deploys `nhtsa-edge-api-dev` after each verified data
or decoder change and smoke-tests it. Add these repository secrets
(Settings → Secrets and variables → Actions):

| Secret | Value |
| :-- | :-- |
| `CLOUDFLARE_API_TOKEN` | API token with the **Edit Cloudflare Workers** template permissions |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account id |

Without them the deploy job is skipped with a warning; everything else still runs.

### Production

Production runs at `https://nhtsa-edge-api.tuannx87.workers.dev`. It is deployed
manually (`pnpm deploy`) after the dev worker has been checked, so a data update never
reaches production without a person looking at it.

### Manual

```bash
npx wrangler login
pnpm deploy:dev      # nhtsa-edge-api-dev
pnpm deploy          # nhtsa-edge-api (production)
```

### Configuration (`wrangler.jsonc` vars)

| Name | Default | Purpose |
| :-- | :-- | :-- |
| `ENVIRONMENT` | `production` / `dev` | Reported by the health endpoint |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Timeout per attempt for proxied NHTSA calls |
| `ENABLE_KV_CACHE` | `false` | Optional KV cache for proxied responses (bind `NHTSA_CACHE_KV`) |

### CI

- `ci.yml` (push to `main`, pull requests): build data assets, typecheck, tests, dry-run bundle.
- `vpic-data.yml` (weekly + on decoder changes): ingest → parity gate → tests → commit →
  dev deploy. Details and revert procedure: [docs/DATA.md](docs/DATA.md).

---

## Legal

- vPIC data is a work of the U.S. Government, in the public domain (17 U.S.C. § 105).
- The data describes vehicle specifications only; it contains no personal or registration data.
- Data source: National Highway Traffic Safety Administration (NHTSA), U.S. DOT. This
  project is independent and not affiliated with or endorsed by NHTSA.

## License

[MIT](LICENSE)
