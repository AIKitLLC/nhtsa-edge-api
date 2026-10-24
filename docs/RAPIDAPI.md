# RapidAPI proxy route: integration guide

Technical handover for `POST /rapid/v1/batch` (pull request
[#23](https://github.com/AIKitLLC/nhtsa-edge-api/pull/23), draft). Nothing here is
deployed. The route answers 403 until `RAPIDAPI_PROXY_SECRET` is set on a deployed
Worker by a person.

## Contract

| Item | Value |
| :-- | :-- |
| Endpoint | `POST https://data.ai-kit.net/rapid/v1/batch` |
| Auth | Worker compares header `X-RapidAPI-Proxy-Secret` with the Worker secret `RAPIDAPI_PROXY_SECRET`. Missing or wrong: HTTP 403, code `RAPIDAPI_PROXY_REQUIRED`. The header is injected by the proxy; API consumers do not send it. |
| Logged only | `X-RapidAPI-User`, `X-RapidAPI-Subscription` are written to the Worker log as one JSON line. They are not access decisions. `X-RapidAPI-Key` is not read and must not be logged. |
| Batch limit | `RAPIDAPI_BATCH_MAX` (plain var, unset in `wrangler.jsonc`). Digits only. Default 100, ceiling 200. Over the limit: HTTP 400, code `BATCH_TOO_LARGE`. |
| Public API | Unchanged. `POST /vehicles/DecodeVINValuesBatch/` still stops at 50 VINs and never reads the proxy secret. `/openapi.json` does not list `/rapid`. |
| Import file | [`openapi/rapidapi.json`](../openapi/rapidapi.json) (OpenAPI 3.0.3), base URL `https://data.ai-kit.net`, path `/rapid/v1/batch` |
| Rate limit | `/rapid` is exempt from the per-IP Worker limiter: the connecting IP is the proxy, so one counter would cover every caller. The proxy applies its own quota upstream of this Worker. |
| Response cache | `Cache-Control: private, no-store`. Responses also carry `X-Decode-Source: LOCAL_VPIC` and `X-Vpic-Data-Version`. |

Request body:

```json
{ "vins": [{ "vin": "1HGCM82633A004352" }, { "vin": "5YJ3E1EB1NF000001", "modelYear": 2022 }] }
```

Each item in `data.results` (same order as the request):

| Field | Meaning |
| :-- | :-- |
| `decode` | Offline vPIC decode. Headline fields are `null` when the VIN does not determine them; `decode.attributes` holds every non-empty decoded value. Check `decode.errorCodes` before trusting a row. |
| `recalls` | `outcome: "provided"` with `count` and `campaigns` (objects as returned by `api.nhtsa.gov`) when that source answers for a 17-character VIN. `"unavailable"` when it does not answer. `"skipped"` for a partial VIN. |
| `fuel` | `outcome: "matched"` with `data` when FuelEconomy.gov matches the decoded year, make, and model. `"no-match"`, `"error"`, or `"skipped"` otherwise. Figures are model-level, not per-VIN. |

A failing recalls or fuel source never fails the request: the decode is still
returned with that section empty. Errors use the standard envelope
`{ "success": false, "error": { "code", "message" }, "timestamp" }`:
400 `INVALID_BODY`, `INVALID_VIN_FORMAT`, `INVALID_MODEL_YEAR`, `BATCH_TOO_LARGE`;
403 `RAPIDAPI_PROXY_REQUIRED`.

## Console configuration (provider side)

1. Import `openapi/rapidapi.json` as a new API version, or add one `POST`
   endpoint at path `/rapid/v1/batch` with base URL `https://data.ai-kit.net`.
2. Set the proxy secret in the provider console (the setting that makes the
   gateway send `X-RapidAPI-Proxy-Secret`). Use the same value that will be set
   on the Worker (next section). Do not put the value in the API definition,
   a code snippet, a ticket, or git.
3. Leave client-side headers alone: consumers send only their proxy-issued
   credentials. Quotas and access control for consumers are enforced by the
   proxy, not by this Worker.
4. Point test calls at the dev Worker first once it has the secret (below).

## Worker configuration (operator side, needs deploy approval)

`wrangler secret put` publishes a Worker version, so it is a deploy action.
Agents do not run it. Sequence for the person doing it, after the pull request
is approved and merged:

```bash
npx wrangler secret put RAPIDAPI_PROXY_SECRET --env dev   # dev Worker first
npx wrangler secret put RAPIDAPI_PROXY_SECRET             # production, separately approved
```

Optional: set plain var `RAPIDAPI_BATCH_MAX` in `wrangler.jsonc` (default 100
is in code; only set it to change the limit). Never commit the secret value.
Local development uses gitignored `.dev.vars` (see `README.md`).

## Acceptance tests

Direct-to-origin negatives (no secret needed, run any time after deploy):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://data.ai-kit.net/rapid/v1/batch \
  -H 'Content-Type: application/json' -d '{"vins":[{"vin":"1HGCM82633A004352"}]}'
# expect 403
```

Through the proxy (after both sides hold the same secret):

1. `POST /rapid/v1/batch` with 2 VINs returns 200, `data.count` is 2, order matches the request.
2. A batch of 51 VINs returns 200 on `/rapid/v1/batch`; the same count on
   `POST /vehicles/DecodeVINValuesBatch/` still returns 400.
3. A batch over the configured max returns 400 `BATCH_TOO_LARGE`.
4. `GET /api/v1/vin/1HGCM82633A004352` without any proxy header still returns 200.
5. Worker logs show one JSON line with `source: "rapidapi"` and the user and
   subscription values, and never the secret.

## Ready-to-file issues

The agent that wrote this guide has no GitHub issue write access (the GitHub
connector is down and the `gh` CLI is read-only in this environment). File these
three issues verbatim; each is self-contained.

### Issue 1

Title: `Configure RAPIDAPI_PROXY_SECRET on the Workers and the matching proxy secret header`
Labels: `type:chore`, `area:platform`, `status:blocked`

```markdown
## Goal
`POST /rapid/v1/batch` (PR #23) answers 403 until the Worker secret
`RAPIDAPI_PROXY_SECRET` exists and the RapidAPI gateway sends the same value
in `X-RapidAPI-Proxy-Secret`.

## Blocked by
PR #23 merged, plus explicit deploy approval. `wrangler secret put` publishes
a Worker version. Agents do not run it and do not read or write secrets.

## Steps (person with deploy rights)
1. `npx wrangler secret put RAPIDAPI_PROXY_SECRET --env dev`
2. Set the proxy secret in the RapidAPI provider console to the same value.
   Do not paste the value into this issue, git, or chat.
3. Run the direct-to-origin negative check in docs/RAPIDAPI.md (expect 403
   without the header), then the through-proxy checks.
4. Repeat for production only with separate approval.

## Done when
- Dev Worker: through-proxy batch of 2 VINs returns 200.
- Direct request without the header still returns 403.
- The secret value appears nowhere in git, issues, or logs.
```

### Issue 2

Title: `Import openapi/rapidapi.json in the RapidAPI provider console`
Labels: `type:chore`, `area:routes`, `status:ready`

```markdown
## Goal
The provider console serves `POST /rapid/v1/batch` from the import file in
this repository, so integrators can call it through the proxy.

## Steps
1. Import `openapi/rapidapi.json` (OpenAPI 3.0.3) from PR #23.
2. Confirm base URL is `https://data.ai-kit.net` and the only path is
   `/rapid/v1/batch`.
3. Confirm the definition contains no secret value and no client parameter
   for `X-RapidAPI-Proxy-Secret` (the gateway injects it; see Issue 1).
4. Publish the endpoint documentation with the outcome tables from
   docs/RAPIDAPI.md (`recalls.outcome`, `fuel.outcome`).

## Done when
- The console shows one endpoint, `rapidBatchDecode`.
- A test call through the proxy reaches the Worker (403 before Issue 1 is
  done, 200 after).
```

### Issue 3

Title: `Run acceptance tests for POST /rapid/v1/batch through the proxy`
Labels: `type:chore`, `area:routes`, `status:blocked`

```markdown
## Goal
Prove the deployed route behaves as specified in docs/RAPIDAPI.md before
integrators rely on it.

## Blocked by
Issues 1 and 2.

## Checks
1. Batch of 2 VINs through the proxy: 200, `data.count` 2, request order kept.
2. Batch of 51 VINs: 200 on `/rapid/v1/batch`; 400 on the public
   `POST /vehicles/DecodeVINValuesBatch/`.
3. Batch over the configured `RAPIDAPI_BATCH_MAX`: 400 `BATCH_TOO_LARGE`.
4. Missing or wrong proxy secret: 403 `RAPIDAPI_PROXY_REQUIRED`.
5. `GET /api/v1/vin/1HGCM82633A004352` without proxy headers: still 200.
6. Worker log line for a proxy call contains the user and subscription
   values and not the secret.

## Done when
All six checks pass on the dev Worker, then on production after its own
approval. Record the Worker version and the date in this issue.
```
