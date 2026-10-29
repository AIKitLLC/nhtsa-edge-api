# Status

Updated in the same pull request as every code or docs change. Last updated: 2026-10-29.

Figures are from the GitHub API (application programming interface) for `AIKitLLC/nhtsa-edge-api` on that date. Default branch: `main`. `main` is `851729d` (`data(vpic): vPICList_lite_2026_10`, live parity 93.90%). The strict parity rate is the `exactRate` in the [vPIC data refresh job summary](https://github.com/AIKitLLC/nhtsa-edge-api/actions/workflows/vpic-data.yml).

[NHTSA](https://www.nhtsa.gov/) is the National Highway Traffic Safety Administration. [vPIC](https://vpic.nhtsa.dot.gov/) is NHTSA's Product Information Catalog and Vehicle Listing. A [VIN](https://www.nhtsa.gov/vin-decoder) is a vehicle identification number.

## Open issues

Nine issues are open. None use `status:blocked`. Milestone fields are empty because no milestone exists on the repository yet. Issues #7 and #20 are closed (#20 by #21).

| Issue | Labels | Proposed milestone |
| :-- | :-- | :-- |
| [#24](https://github.com/AIKitLLC/nhtsa-edge-api/issues/24) Mandatory CI/CD deploy; no deploys from a local machine | `priority:p0` | none |
| [#22](https://github.com/AIKitLLC/nhtsa-edge-api/issues/22) Follow-ups from Security review of #21 (non-blocking) | none | none |
| [#8](https://github.com/AIKitLLC/nhtsa-edge-api/issues/8) Bundle an offline copy of NHTSA safety recalls | `type:feature`, `area:pipeline`, `area:routes`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#9](https://github.com/AIKitLLC/nhtsa-edge-api/issues/9) Serve the full [EPA](https://www.epa.gov/) (Environmental Protection Agency) and [DOE](https://www.energy.gov/) (Department of Energy) fuel-economy dataset. In review: [#26](https://github.com/AIKitLLC/nhtsa-edge-api/pull/26) | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#10](https://github.com/AIKitLLC/nhtsa-edge-api/issues/10) Add NHTSA complaints and [NCAP](https://www.nhtsa.gov/ratings) (New Car Assessment Program) crash-test ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#11](https://github.com/AIKitLLC/nhtsa-edge-api/issues/11) Add [United Kingdom](https://www.gov.uk/) [DVSA](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency) (Driver and Vehicle Standards Agency) [MOT](https://www.gov.uk/getting-an-mot) (Ministry of Transport test) history | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#12](https://github.com/AIKitLLC/nhtsa-edge-api/issues/12) Add the Australian Green Vehicle Guide | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#13](https://github.com/AIKitLLC/nhtsa-edge-api/issues/13) Add [Euro NCAP](https://www.euroncap.com/) ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#14](https://github.com/AIKitLLC/nhtsa-edge-api/issues/14) Refresh the parity figure in `HANDOFF.md` | `type:docs`, `area:docs`, `status:ready`, `priority:p2` | none |

Euro NCAP in #13 is a separate program from NHTSA NCAP in #10.

## Open pull requests

| Pull request | Branch | Linked issue |
| :-- | :-- | :-- |
| [#23](https://github.com/AIKitLLC/nhtsa-edge-api/pull/23) Add a RapidAPI proxy batch route | `cursor/rapidapi-proxy-route-d053` | draft |
| [#26](https://github.com/AIKitLLC/nhtsa-edge-api/pull/26) Serve the full EPA / DOE fuel-economy dataset | `claude/exciting-pascal-8khdrj` | closes #9 |

Merged, not open: [#17](https://github.com/AIKitLLC/nhtsa-edge-api/pull/17) (STATUS refresh), [#21](https://github.com/AIKitLLC/nhtsa-edge-api/pull/21) (data.gov key stays on its hosts, proxy cache bypass closed; closes #20), #19 (drop personal workers.dev hostname), #18 (known-renames allowlist for the parity gate), [#6](https://github.com/AIKitLLC/nhtsa-edge-api/pull/6) (agent standards, closes #7), #16, #5, #4, #3, #2, #1.

## Labels

Standards labels are on the repository, alongside the original GitHub defaults (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`). Nothing was deleted.

`type:feature`, `type:bug`, `type:chore`, `type:docs`, `area:vpic`, `area:routes`, `area:services`, `area:enrichment`, `area:validation`, `area:pipeline`, `area:data`, `area:platform`, `area:docs`, `status:ready`, `status:in-progress`, `status:in-review`, `status:blocked`, `priority:p0`, `priority:p1`, `priority:p2`.

`area:*` matches the modules in `docs/ARCHITECTURE.md`, plus `area:docs` for `docs/`, `README.md`, and `HANDOFF.md`.

## Milestones

None exist. The milestones list for this repository was empty on 2026-10-15. The plan, not yet created:

| Milestone | What it covers | Issues to assign when it exists |
| :-- | :-- | :-- |
| M1 Foundation | Offline vPIC decoder, dataset hub, weekly git-tracked data, dev deploy. Shipped on `main`. | none open |
| M2 Dataset completeness | Hub datasets that are partial or planned: offline recalls, full fuel economy, complaints and NCAP | #8, #9, #10 |
| M3 Further public datasets | Sources named in `HANDOFF.md`: United Kingdom DVSA MOT history, Australian Green Vehicle Guide, Euro NCAP | #11, #12, #13 |

## CI

Pull requests run two workflows. A green check means the job ran and finished with conclusion `success`. A skipped job does not count.

| Workflow | What it runs | Permissions |
| :-- | :-- | :-- |
| [CI](.github/workflows/ci.yml) | Typecheck, Vitest on the real vPIC data, dry-run Worker bundle | `contents: read` |
| [Architecture](.github/workflows/architecture.yml) | arcade-agent 0.4.1, action commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d`, report only (`continue-on-error: true`) | `contents: read`, `actions: read` |

Checks for `cursor/security-hardening-a411` start when that branch is pushed. They are not copied into this file until they finish. The last recorded runs below are from commit `7096f27` (rebased onto `aa309df`, 2026-10-15):

| Check | Result | Run |
| :-- | :-- | :-- |
| [CI](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38750177874) | `success`. Checkout, install, asset build, typecheck, tests, and dry-run bundle each finished `success`. None were skipped. | 38750177874 |
| [Architecture](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38750177950) | `success`. The analyze step finished `success` in 34 seconds. | 38750177950 |
| vPIC data refresh and dev deploy | `cancelled` during the SQL comparison step. The dev-deploy job never started, so nothing was deployed. | 38750169916 |

The refresh workflow starts on a push that changes `src/**`. The rebase did that relative to the previous branch tip. Cancelling it from this agent returned HTTP 403; the run still ended `cancelled` before deploy. A docs-only commit does not match those paths, so it does not start that workflow again.

Primary arcade-agent result on that run (algorithm `pkg`): 212 entities, 219 edges, 8 components, balanced score 0.6219, RCI (cohesive interactions) 0.6530. No baseline artifact exists on `main`, so there is no drift delta yet. The job log is the report.

Deploy production and the Cloudflare check workflow do not run on this pull request. This change does not deploy.

## Known blockers

- No issue is `status:blocked`.
- Milestones are not created, so #8 through #13 are not on a milestone yet.
- Production deploy stays manual. Agents do not deploy, do not run `wrangler login`, and do not read or write Cloudflare secrets, including `DATA_GOV_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
- `HANDOFF.md` says the unbound [D1](https://developers.cloudflare.com/d1/) database `nhtsa-db` can be deleted. D1 is Cloudflare's relational database. That is a Cloudflare account change. Agents do not do it.

## Next steps

1. Security review of draft #23 before it leaves draft. #21 is merged; its follow-ups are in #22.
2. Create milestones M1, M2, and M3, then assign #8–#10 to M2 and #11–#13 to M3.
3. Close #14 when Tony accepts the job-summary link in `HANDOFF.md` in place of a frozen parity percentage.
4. Leave deploy and secrets alone.
