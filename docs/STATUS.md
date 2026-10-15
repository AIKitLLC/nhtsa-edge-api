# Status

Updated in the same pull request as every code or docs change. Last updated: 2026-10-15.

Figures are from the GitHub [API](https://en.wikipedia.org/wiki/API) (application programming interface) for `AIKitLLC/nhtsa-edge-api` on that date. Default branch: `main`. `main` is [`e37679c8ca168bf5c8aeaff24359a7b075aa83b2`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/e37679c8ca168bf5c8aeaff24359a7b075aa83b2) (`Merge pull request #6 from AIKitLLC/cursor/dev-standards-67a5`). Times below are [UTC](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) (Coordinated Universal Time). A commit [SHA](https://en.wikipedia.org/wiki/SHA-1) is the Secure Hash Algorithm 1 identifier GitHub stores for that commit.

[NHTSA](https://www.nhtsa.gov/) is the National Highway Traffic Safety Administration. [vPIC](https://vpic.nhtsa.dot.gov/) is [NHTSA](https://www.nhtsa.gov/)'s Product Information Catalog and Vehicle Listing. A [VIN](https://www.nhtsa.gov/vin-decoder) is a vehicle identification number.

## Standards

These stay in force. `AGENTS.md` and the Cursor rules on this branch are the source.

| Standard | Where it lives | What it requires |
| :-- | :-- | :-- |
| Ponytail | `.agents/skills/ponytail/`, vendored from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) commit `9b58c1ffb790c075ca32e70a89cf1d80588f4abf`, [MIT](https://opensource.org/license/mit) License | Smallest complete diff. Reuse what is already here. |
| i-have-adhd | `.agents/skills/i-have-adhd/`, vendored from [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) commit `723af7d9afaf43eb871dbcce6129e2bf80de90d5`, [MIT](https://opensource.org/license/mit) License | Next action first, numbered steps, short lists. |
| Cloudflare skills | Referenced from [cloudflare/skills](https://github.com/cloudflare/skills) commit `0871daceb347e3c51693fbe9c77555468df7e410`. The text is kept upstream. | Read `wrangler`, `workers-best-practices`, and `web-perf` before Worker design. |
| Decoupling, multi-module | `docs/ARCHITECTURE.md` and `.cursor/rules/architecture.mdc` | Domain modules, adapters for external services, and platform bindings. Modules talk through public entry points. |
| arcade-agent | [PyPI](https://pypi.org/project/arcade-agent/) (Python Package Index) package `arcade-agent==0.4.1`, action commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d`, [docs](https://arcade-agent.dev/docs/getting-started/) | Report-only drift check on pull requests. Local server: `uvx --from "arcade-agent[mcp,languages]==0.4.1" arcade-mcp` in `.cursor/mcp.json`. |

[MCP](https://modelcontextprotocol.io/) is the Model Context Protocol. `AGENTS.md` lists [D1](https://developers.cloudflare.com/d1/) (Cloudflare's relational database), [R2](https://developers.cloudflare.com/r2/) (Cloudflare's object storage), Durable Objects, and Email as products with no binding in this Worker.

## Planned issues #7–#14

All eight issues exist on GitHub. Fetched 2026-10-15. Milestone fields are empty. Seven issues are open (#8–#14). #7 is closed.

| Issue | State | Labels | Proposed milestone |
| :-- | :-- | :-- | :-- |
| [#7](https://github.com/AIKitLLC/nhtsa-edge-api/issues/7) Adopt Tony's agent and architecture standards | Closed 2026-10-15T19:21:15Z, when pull request #6 merged | `type:chore`, `status:in-review`, `priority:p1` (labels were still these at fetch time) | none |
| [#8](https://github.com/AIKitLLC/nhtsa-edge-api/issues/8) Bundle an offline copy of [NHTSA](https://www.nhtsa.gov/) safety recalls | Open | `type:feature`, `area:pipeline`, `area:routes`, `status:ready`, `priority:p2` | M2 Dataset completeness, to create |
| [#9](https://github.com/AIKitLLC/nhtsa-edge-api/issues/9) Serve the full [EPA](https://www.epa.gov/) (Environmental Protection Agency) and [DOE](https://www.energy.gov/) (Department of Energy) fuel-economy dataset | Open | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness, to create |
| [#10](https://github.com/AIKitLLC/nhtsa-edge-api/issues/10) Add [NHTSA](https://www.nhtsa.gov/) complaints and [NCAP](https://www.nhtsa.gov/ratings) (New Car Assessment Program) crash-test ratings | Open | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness, to create |
| [#11](https://github.com/AIKitLLC/nhtsa-edge-api/issues/11) Add [United Kingdom](https://www.gov.uk/) [DVSA](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency) (Driver and Vehicle Standards Agency) [MOT](https://www.gov.uk/getting-an-mot) (Ministry of Transport test) history | Open | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets, to create |
| [#12](https://github.com/AIKitLLC/nhtsa-edge-api/issues/12) Add the Australian Green Vehicle Guide | Open | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets, to create |
| [#13](https://github.com/AIKitLLC/nhtsa-edge-api/issues/13) Add [Euro NCAP](https://www.euroncap.com/) ratings | Open | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets, to create |
| [#14](https://github.com/AIKitLLC/nhtsa-edge-api/issues/14) Refresh the parity figure in `HANDOFF.md` | Open | `type:docs`, `area:docs`, `status:ready`, `priority:p2` | none |

Euro [NCAP](https://www.euroncap.com/) in #13 is a separate program from [NHTSA](https://www.nhtsa.gov/) [NCAP](https://www.nhtsa.gov/ratings) in #10.

Issue #14's body still says `HANDOFF.md` quotes 95.4% live parity. On `main`, `HANDOFF.md` says 93.6% of 1,000 [VIN](https://www.nhtsa.gov/vin-decoder)s for the 2026-10-03 run. The issue stays open. This commit leaves it open.

## Milestones

M1, M2, and M3 are **to create**. The GitHub [API](https://en.wikipedia.org/wiki/API) milestones list for this repository was empty on 2026-10-15. The plan, once someone creates them:

| Milestone | State on GitHub | What it covers | Issues to assign when it exists |
| :-- | :-- | :-- | :-- |
| M1 Foundation | to create | Offline [vPIC](https://vpic.nhtsa.dot.gov/) decoder, dataset hub, weekly git-tracked data, dev deploy. Shipped on `main`. | none open |
| M2 Dataset completeness | to create | Hub datasets that are partial or planned: offline recalls, full fuel economy, complaints and [NCAP](https://www.nhtsa.gov/ratings) | #8, #9, #10 |
| M3 Further public datasets | to create | Sources named in `HANDOFF.md`: United Kingdom [DVSA](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency) [MOT](https://www.gov.uk/getting-an-mot) history, Australian Green Vehicle Guide, Euro [NCAP](https://www.euroncap.com/) | #11, #12, #13 |

## Pull requests

This page is the open draft [#17](https://github.com/AIKitLLC/nhtsa-edge-api/pull/17), a docs commit on top of `main` at `e37679c8ca168bf5c8aeaff24359a7b075aa83b2`.

| Pull request | State | Head [SHA](https://en.wikipedia.org/wiki/SHA-1) | Linked issue |
| :-- | :-- | :-- | :-- |
| [#17](https://github.com/AIKitLLC/nhtsa-edge-api/pull/17) Refresh `docs/STATUS.md` for 2026-10-15 | Open, draft. Branch `cursor/docs-status-refresh-773a`. | [`8654266144aba46f577b06f73ae4fd71cd2c9faf`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/8654266144aba46f577b06f73ae4fd71cd2c9faf), plus this pull-request row | none |
| [#6](https://github.com/AIKitLLC/nhtsa-edge-api/pull/6) Adopt agent standards, architecture map, and arcade-agent [CI](https://en.wikipedia.org/wiki/Continuous_integration) (continuous integration) | Merged 2026-10-15T19:21:14Z. Merge commit [`e37679c8ca168bf5c8aeaff24359a7b075aa83b2`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/e37679c8ca168bf5c8aeaff24359a7b075aa83b2). Branch `cursor/dev-standards-67a5`. | [`c370f631a0cfa63b080948cc0efc4af1525621bb`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/c370f631a0cfa63b080948cc0efc4af1525621bb) | Closed [#7](https://github.com/AIKitLLC/nhtsa-edge-api/issues/7) |
| [#16](https://github.com/AIKitLLC/nhtsa-edge-api/pull/16) Run the [vPIC](https://vpic.nhtsa.dot.gov/) data refresh and dev deploy on `main` | Merged 2026-10-15T19:20:56Z. Merge commit [`cb593739344482881e8469bab2257fa2225096d8`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/cb593739344482881e8469bab2257fa2225096d8). | [`95dbf3092ad7691d9e7dd045fc54d68703e2647e`](https://github.com/AIKitLLC/nhtsa-edge-api/commit/95dbf3092ad7691d9e7dd045fc54d68703e2647e) | Closed [#15](https://github.com/AIKitLLC/nhtsa-edge-api/issues/15) |

Merged earlier: [#5](https://github.com/AIKitLLC/nhtsa-edge-api/pull/5) (rate limit, [OpenAPI](https://www.openapis.org/) description, `/docs`, `llms.txt` for [large language models](https://en.wikipedia.org/wiki/Large_language_model), batch page, comparison doc), #4 naming, #3 workers.dev address, #2 website, #1 offline decoder.

## [CI](https://en.wikipedia.org/wiki/Continuous_integration)

Pull requests run two workflows. A green check means the job ran and finished with conclusion `success`.

| Workflow | What it runs | Permissions |
| :-- | :-- | :-- |
| [CI](https://en.wikipedia.org/wiki/Continuous_integration) ([workflow](.github/workflows/ci.yml)) | Typecheck, Vitest on the real [vPIC](https://vpic.nhtsa.dot.gov/) data, dry-run Worker bundle. Push trigger is `main`. Pull requests also run it. | `contents: read` |
| [Architecture](.github/workflows/architecture.yml) | arcade-agent 0.4.1, action commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d`, report only (`continue-on-error: true`). Pull requests only. | `contents: read`, `actions: read` |

Latest [CI](https://en.wikipedia.org/wiki/Continuous_integration) run, on the merge of #6 to `main` (`e37679c8ca168bf5c8aeaff24359a7b075aa83b2`), created 2026-10-15T19:21:17Z:

| Check | Result | Run |
| :-- | :-- | :-- |
| [CI](https://en.wikipedia.org/wiki/Continuous_integration) | `success` at 2026-10-15T19:22Z. Checkout, install, asset build, typecheck, tests, and dry-run bundle each finished `success`. | [38793202814](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38793202814) |

Latest Architecture run. Architecture has no run on the merge to `main`. The newest run is still the one on pull request #6's head `c370f631a0cfa63b080948cc0efc4af1525621bb`, created 2026-10-15T14:24:36Z:

| Check | Result | Run |
| :-- | :-- | :-- |
| [CI](https://en.wikipedia.org/wiki/Continuous_integration) on that head | `success` at 2026-10-15T14:25:05Z. The same six steps each finished `success`. | [38751128028](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38751128028) |
| [Architecture](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38751127871) | `success` at 2026-10-15T14:25:04Z. The analyze step finished `success`. | 38751127871 |

Latest [vPIC](https://vpic.nhtsa.dot.gov/) data refresh and dev deploy run is [38793164071](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38793164071), on the merge of #16 (`cb593739344482881e8469bab2257fa2225096d8`), created 2026-10-15T19:20:59Z. The refresh job finished `failure` because live parity was 83.20%, under the 85% gate. The dev-deploy job finished `skipped`.

## Arcade-agent drift

Latest measurement: 2026-10-15T14:25:01Z, Architecture run [38751127871](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38751127871), commit `c370f631a0cfa63b080948cc0efc4af1525621bb`, algorithm `pkg` as printed by the analyze step, arcade-agent 0.4.1.

| Figure | Latest value |
| :-- | :-- |
| Entities | 212 |
| Edges | 219 |
| Components | 8 |
| Balanced score | 0.6219 |
| [RCI](https://arcade-agent.dev/docs/getting-started/) (cohesive interactions) | 0.6530 |

The log line is `No baseline available — first run or baseline expired.` The comparison summary then lists the current figures only. The prior measurement recorded in this file for commit `7096f279dd4f5e893e7b152736dd9cbe7a294213` (run [38750177950](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38750177950), same date) was 212 entities, 219 edges, 8 components, balanced score 0.6219, [RCI](https://arcade-agent.dev/docs/getting-started/) 0.6530. The latest log prints those same figures.

## Deploy workflow trigger

Done via [#16](https://github.com/AIKitLLC/nhtsa-edge-api/pull/16). Tech Lead · [SRE](https://en.wikipedia.org/wiki/Site_reliability_engineering) (site reliability engineering) restricted the deploy workflow trigger so a feature-branch push cannot refresh data or deploy the dev worker. Pull request #16 merged at 2026-10-15T19:20:56Z and closed #15. On `main`, `.github/workflows/vpic-data.yml` limits `push` to `branches: [main]`, and the refresh job and the `deploy-dev` job each require `github.ref == 'refs/heads/main'`.

This commit edits `docs/STATUS.md` only.

## Known blockers

- GitHub Actions is running again. [CI](https://en.wikipedia.org/wiki/Continuous_integration) on `main` finished `success` at 2026-10-15T19:22Z ([38793202814](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38793202814)). The billing endpoint `GET /orgs/AIKitLLC/settings/billing/actions` returned [HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP) (Hypertext Transfer Protocol) 403, `Resource not accessible by integration`. Pull request #16's body had recorded a billing block earlier on 2026-10-15 (about 11:30 [Central Time](https://en.wikipedia.org/wiki/Central_Time_Zone)).
- Milestones M1, M2, and M3 are to create, so #8 through #13 sit on an empty milestone field.
- Production deploy stays manual. Deploy, `wrangler login`, and Cloudflare secret names (`DATA_GOV_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) stay with Tony.
- `HANDOFF.md` says the unbound [D1](https://developers.cloudflare.com/d1/) database `nhtsa-db` can be deleted. That is a Cloudflare account change.

## Labels

Standards labels are on the repository, alongside the original GitHub defaults (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`).

`type:feature`, `type:bug`, `type:chore`, `type:docs`, `area:vpic`, `area:routes`, `area:services`, `area:enrichment`, `area:validation`, `area:pipeline`, `area:data`, `area:platform`, `area:docs`, `status:ready`, `status:in-progress`, `status:in-review`, `status:blocked`, `priority:p0`, `priority:p1`, `priority:p2`.

`area:*` matches the modules in `docs/ARCHITECTURE.md`, plus `area:docs` for `docs/`, `README.md`, and `HANDOFF.md`.

## Next steps

1. Create milestones M1, M2, and M3, then assign #8–#10 to M2 and #11–#13 to M3.
2. Close #14, or rewrite its body, after confirming `HANDOFF.md` already says 93.6%.
3. Have someone who can read organization billing confirm the GitHub Actions budget. Actions is running again. This fetch received [HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP) 403 from the billing endpoint.
4. Leave deploy and secrets alone.
