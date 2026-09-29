# NHTSA Edge API — Project Handoff

> **Repository**: https://github.com/AIKitLLC/nhtsa-edge-api (AI Kit LLC)
> **Production**: https://data.ai-kit.net (also https://nhtsa-edge-api.tuannx87.workers.dev); manual deploy: GitHub Actions *Deploy production* or `pnpm deploy`
> **Dev**: `nhtsa-edge-api-dev` (deployed by `.github/workflows/vpic-data.yml`)
> **Data**: `vPICList_lite_2026_09` (see `data/vpic/manifest.json`)

---

## Summary

A Cloudflare Worker (Hono) that decodes VINs **offline**: a TypeScript port of NHTSA's
own `spVinDecode` runs over the official monthly vPIC dump, bundled as static assets.
It is a drop-in replacement for the vPIC decode endpoints, adds a clean v1 API, and a
`/unified` profile enriched with US EPA and EU RDW reference data.

| Topic | State |
| :-- | :-- |
| Decoder | Full `spVinDecode` port (`src/vpic/`), every public vPIC variable, partial VINs, error codes |
| Correctness vs NHTSA's SQL | 0 unexplained differences on 11,000 VINs and ~4 M function inputs; re-checked weekly on the original dump ([docs/DATA.md](docs/DATA.md#verification-against-the-reference-sql-functions)) |
| Parity vs live API | 95.4 % of 1,000 VINs identical on every field; the rest is newer live data |
| Latency | p50 1.4 ms, p95 6.2 ms per decode, no network call |
| Data updates | Weekly workflow: ingest dump → verify → commit `data/vpic` to git → deploy dev |
| Tests | `pnpm typecheck && pnpm test` (Vitest, real data assets) |

The earlier architecture (D1 database, WMI-only `local-decoder`, NHTSA upstream with
local fallback, nightly cron sync) was replaced by the offline decoder: every decode is
answered locally, so there is no upstream to fall back from and nothing to sync at
runtime. The D1 database `nhtsa-db` is no longer bound and can be deleted.

---

## Key files

| Path | Purpose |
| :-- | :-- |
| `src/vpic/` | The decoder (`decode.ts`, `decode-core.ts`, `decode-errors.ts`, ...) and response formats |
| `src/routes/v1/` | `/api/v1/vin/:vin`, `/unified`, `/compare`, catalog, recalls |
| `src/routes/vpic-decode.ts`, `vpic-proxy.ts` | vPIC drop-in: offline decodes, other endpoints proxied + cached |
| `src/enrichment/` | EPA FuelEconomy.gov and RDW lookups (model-level) |
| `src/routes/health.ts`, `src/routes/landing/` | `/` (hub for browsers, health JSON for API clients), `/health`, `/vpic`; pages: `layout.ts`, `hub.ts` (dataset registry), `vpic.ts`, `style.ts`, `script.ts` |
| `scripts/vpic/` | `ingest-dump.ts`, `build-assets.ts`, `parity.ts`, `sql-verify/` |
| `data/vpic/` | vPIC tables used by the decoder (git-tracked, reviewed and reverted like code) |
| `docs/DATA.md` | Data pipeline, verification, revert procedure, known limitations |
| `docs/NHTSA-ERRATA.md` | Defects found in NHTSA's dump, evidence, and what the port does about them |
| `docs/vpic-reference/` | NHTSA's decode functions, verbatim |

---

## Endpoints

- `GET /api/v1/vin/:vin[?modelyear=YYYY]` — clean JSON decode
- `GET /api/v1/vin/:vin/unified[?epa=false&eu=false]` — decode + EPA + RDW
- `GET /api/v1/vin/:vin/compare` — offline vs live vPIC, field by field
- `GET /vehicles/DecodeVinValues/:vin?format=json[&clean=true]`, `DecodeVin`, `POST DecodeVINValuesBatch`
- `GET /api/v1/makes`, `/api/v1/models?make=`, `/api/v1/recalls/:vin`, `/vehicles/*`, `/recalls/*`

Branding: `X-Powered-By` / `X-Repository` headers, `_meta` in v1 responses, landing page at `/`.

---

## How to resume

1. Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` enable the dev deploy.
2. The weekly schedule runs on the default branch only; allow GitHub Actions to push to
   `main` if it is protected (the workflow commits data updates).
3. Production (data.ai-kit.net): after checking the dev worker, run the *Deploy production*
   workflow on `main` (or `pnpm deploy`); it also smoke-tests the workers.dev URL. If a deploy
   fails with an authentication error, run *Cloudflare check* (read-only). Use Workers Paid
   (10 ms CPU limit on the free plan).
4. Ideas: UK DVSA MOT history, Australian Green Vehicle Guide, Euro NCAP ratings — as
   further `src/enrichment/` modules.
