# Status

Updated in the same pull request as every code or docs change. Last updated: 2026-10-17.

Figures are from the GitHub API (application programming interface) for `AIKitLLC/nhtsa-edge-api` on that date. Default branch: `main`. `main` is `68623a7` (`data(vpic): vPICList_lite_2026_09 (live parity 83.20%)`).

[NHTSA](https://www.nhtsa.gov/) is the National Highway Traffic Safety Administration. [vPIC](https://vpic.nhtsa.dot.gov/) is NHTSA's Product Information Catalog and Vehicle Listing. A [VIN](https://www.nhtsa.gov/vin-decoder) is a vehicle identification number.

## Open issues

Eight issues are open. None use `status:blocked`. Milestone fields are empty because no milestone exists on the repository yet. Issue #7 is closed.

| Issue | Labels | Proposed milestone |
| :-- | :-- | :-- |
| [#20](https://github.com/AIKitLLC/nhtsa-edge-api/issues/20) Stop sending the data.gov key off-host and close the proxy cache bypass | none (this token cannot add labels) | none |
| [#8](https://github.com/AIKitLLC/nhtsa-edge-api/issues/8) Bundle an offline copy of NHTSA safety recalls | `type:feature`, `area:pipeline`, `area:routes`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#9](https://github.com/AIKitLLC/nhtsa-edge-api/issues/9) Serve the full [EPA](https://www.epa.gov/) (Environmental Protection Agency) and [DOE](https://www.energy.gov/) (Department of Energy) fuel-economy dataset | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#10](https://github.com/AIKitLLC/nhtsa-edge-api/issues/10) Add NHTSA complaints and [NCAP](https://www.nhtsa.gov/ratings) (New Car Assessment Program) crash-test ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#11](https://github.com/AIKitLLC/nhtsa-edge-api/issues/11) Add [United Kingdom](https://www.gov.uk/) [DVSA](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency) (Driver and Vehicle Standards Agency) [MOT](https://www.gov.uk/getting-an-mot) (Ministry of Transport test) history | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#12](https://github.com/AIKitLLC/nhtsa-edge-api/issues/12) Add the Australian Green Vehicle Guide | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#13](https://github.com/AIKitLLC/nhtsa-edge-api/issues/13) Add [Euro NCAP](https://www.euroncap.com/) ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#14](https://github.com/AIKitLLC/nhtsa-edge-api/issues/14) Refresh the parity figure in `HANDOFF.md` | `type:docs`, `area:docs`, `status:ready`, `priority:p2` | none |

Euro NCAP in #13 is a separate program from NHTSA NCAP in #10.

Issue #14's body still says `HANDOFF.md` quotes 95.4% live parity. This pull request sets that sentence to the strict rate **83.20%** from commit `68623a7` (the gate passes via the known-renames allowlist). The issue stays open until someone closes it. This pull request closes #20, not #14.

## Open pull requests

| Pull request | Branch | Linked issue |
| :-- | :-- | :-- |
| [#17](https://github.com/AIKitLLC/nhtsa-edge-api/pull/17) docs: refresh STATUS.md (2026-10-15) | `cursor/docs-status-refresh-773a` | none (draft) |
| [#21](https://github.com/AIKitLLC/nhtsa-edge-api/pull/21) Keep the data.gov key on its hosts and close the proxy cache bypass | `cursor/security-hardening-a411` | [Closes #20](https://github.com/AIKitLLC/nhtsa-edge-api/issues/20) |

Merged, not open: [#6](https://github.com/AIKitLLC/nhtsa-edge-api/pull/6) (agent standards, closes #7), [#5](https://github.com/AIKitLLC/nhtsa-edge-api/pull/5) (rate limit, [OpenAPI](https://www.openapis.org/) description, `/docs`, `llms.txt`, batch page, comparison doc), #4 naming, #3 workers.dev address, #2 website, #1 offline decoder.

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

1. Security (Chuyên gia Bảo mật) PASS on pull request #21, then Tony's approval. Do not merge or deploy before that.
2. Create milestones M1, M2, and M3, then assign #8–#10 to M2 and #11–#13 to M3.
3. Close #14 after confirming `HANDOFF.md` quotes the strict 83.20% rate.
4. Leave deploy and secrets alone.
