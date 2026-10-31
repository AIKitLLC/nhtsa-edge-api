# AI Kit Data

US public data at the edge, served at **https://data.ai-kit.net** from **Cloudflare Workers**.
The site is a hub of datasets; the first one is NHTSA's vehicle database (vPIC), decoded
**offline** inside the Worker. The repository, Worker and package keep the name
`nhtsa-edge-api` (renaming a Worker would create a new one and break its URLs).

| Dataset | Status |
| :-- | :-- |
| NHTSA vehicle identification (vPIC) | Live, served from bundled data |
| NHTSA safety recalls | Partial: proxied to NHTSA and cached |
| EPA / DOE fuel economy and electric range | Live: every EPA record by year and make in `/api/v1/fuel-economy`; model-level data also in `/api/v1/vin/:vin/unified` |
| NHTSA complaints and crash test ratings | Planned |
| Leaked password check ([Have I Been Pwned](https://haveibeenpwned.com/Passwords)) | Partial: password range proxied to Pwned Passwords; email lookup planned |

The status list of the site lives in `src/routes/landing/hub.ts`; a dataset is only "Live" when
its data is served from this Worker.

## VIN decoder (vPIC)

- Decodes full and partial VINs **without calling NHTSA**: a TypeScript port of vPIC's
  own `spVinDecode` runs over the official monthly vPIC dump, bundled with the worker as
  static assets.
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
- **Documented**: [OpenAPI 3.1](https://data.ai-kit.net/openapi.json), a rendered
  [API reference](https://data.ai-kit.net/docs), a [batch page](https://data.ai-kit.net/batch)
  (paste or upload up to 500 VINs, download CSV) and `/llms.txt` for agents. API requests are
  limited to 120 per minute per client and location (HTTP 429 with `Retry-After`).
  If the rate-limiter binding is missing or errors, the API fails closed with HTTP 503 and `Retry-After`.
- **Honest comparison** with vPIC and with bundled-library approaches such as Corgi:
  [docs/COMPARISON.md](docs/COMPARISON.md).

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
| `GET` | `/` | Browsers: the datasets hub. API clients: health JSON (`status`, `dataVersion`; 503 if the data assets are unreadable) |
| `GET` | `/health` | Health JSON, always |
| `GET` | `/vpic` | The live VIN decoder page |
| `GET` | `/api/v1/fuel-economy?year=&make=[&model=]` | EPA / DOE FuelEconomy.gov records (MPG, MPGe, electric range, CO2, fuel cost) from a bundled copy of `vehicles.csv`; no call to FuelEconomy.gov. 404 when nothing matches |
| `GET` | `/api/v1/vin/:vin/unified[?epa=false&eu=false]` | Offline decode + US EPA FuelEconomy.gov (EV range, MPGe, motor) + EU RDW (type approval, masses). Enrichments are model-level, not VIN-specific; a failed enrichment leaves its section `null` and the response uncached |
| `GET` | `/api/v1/vin/:vin/compare` | Offline decode vs live vPIC, field by field (cached 24 h) |
| `GET` | `/api/v1/recalls/:vin` | Recalls for a 17-character VIN (proxied to `api.nhtsa.gov`, cached 6 h) |
| `GET` | `/vehicles/*` | Allowlisted vPIC endpoints, including `*Extended` decodes (proxied, cached). Other paths are HTTP 400 |
| `GET` | `/recalls/*` | Allowlisted recalls endpoints (`recallsByVehicle`, `recallsByVin`), cached. Other paths are HTTP 400 |

### Leak check

| Method | Endpoint | Notes |
| :-- | :-- | :-- |
| `GET` | `/api/v1/leak/password/range/:prefix` | First 5 hex characters of a password's SHA-1. Returns HIBP's `SUFFIX:COUNT` lines as `text/plain`, padded with zero-count lines so the response size does not reveal the prefix (cached 24 h). No key; the password never leaves the client |

```bash
# Is "password" in a breach? SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
curl -s https://data.ai-kit.net/api/v1/leak/password/range/5BAA6 | grep -i 1E4C9B93F3F0682250B6CF8331B7EE68FD8
# 1E4C9B93F3F0682250B6CF8331B7EE68FD8:52372427
```

An email breach lookup (`src/routes/v1/leak-email.ts`, paid HIBP API) is written and tested but not
mounted until an HIBP API key is in place.

Proxied endpoints forward only known query parameters, so extra parameters cannot bypass
the cache. The Cache API is a no-op on `*.workers.dev`; attach a custom domain (or enable
the optional KV cache) for caching of proxied responses. Offline decoding does not
depend on it.

---

## Accuracy

`scripts/vpic/parity.ts` decodes a deterministic set of 1,000 VINs (real VINs from the
dump, VINs built from real model patterns, and error cases) and compares **every field**
with the live `DecodeVINValuesBatch` API.

The strict rate is the `exactRate` printed in the
[vPIC data refresh job summary](https://github.com/AIKitLLC/nhtsa-edge-api/actions/workflows/vpic-data.yml)
(and in that run's data commit message). The weekly gate passes when the strict matches
plus the known-renames allowlist meet `VPIC_PARITY_MIN` (default 85%). The strict rate
moves when NHTSA edits data after the dump is published. Details: [docs/DATA.md](docs/DATA.md).

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
  epa/                  bundled EPA / DOE fuel-economy data: reads one asset per model year and make
  routes/               v1 API (incl. fuel-economy), vPIC drop-in (vpic-decode.ts offline, vpic-proxy.ts), recalls
    landing/            site pages: hub, VIN decoder, batch, API docs
    openapi/            openapi.json and llms.txt
  services/             upstream fetch, cache, multi-source resolver, response helpers
  enrichment/           US EPA FuelEconomy.gov and EU RDW lookups for /unified
scripts/vpic/           ingest-dump.ts, build-assets.ts, parity.ts (+ lib/)
scripts/epa/            ingest.ts (vehicles.csv into data/epa), build-assets.ts, csv.ts
data/vpic/              the vPIC tables used by the decoder (git-tracked)
data/epa/               FuelEconomy.gov vehicles.tsv and manifest.json (git-tracked, refreshed weekly)
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

### Production (data.ai-kit.net)

Production is served at **https://data.ai-kit.net**. It is deployed manually after the dev worker has been checked, so a data
update never reaches production without a person looking at it:

- **From GitHub:** Actions → *Deploy production* → Run workflow on `main`, type `deploy`.
  It runs the tests, deploys, and smoke-tests the live site. Add required reviewers to the
  `production` environment (Settings → Environments) to make it a two-person step.
- **Or locally:** `pnpm deploy`.

The custom domain is the `routes` entry of `wrangler.jsonc`; it needs the `ai-kit.net` zone on
the same Cloudflare account, and wrangler then creates the DNS record and the certificate itself.
The first production deploy worked with the same API token that deploys the dev worker. If a
deploy ever fails with an authentication error, run *Actions → Cloudflare check*: it reports
the token, the zone and what is already bound to the hostname (read-only).

`workers_dev` is set to `true` on purpose: configuring `routes` makes wrangler turn workers.dev
off otherwise, which would take down the original URL.

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
- Leaked password data comes from [Have I Been Pwned](https://haveibeenpwned.com)'s Pwned Passwords.
  This project is not affiliated with Have I Been Pwned.

## License

[MIT](LICENSE)
