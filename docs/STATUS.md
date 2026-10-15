# Status

Updated in the same pull request as every code or docs change. Last updated: 2026-10-15.

Figures are from the GitHub API (application programming interface) for `AIKitLLC/nhtsa-edge-api` on that date. Default branch: `main`. `main` is `aa309df` (`feat(auth): integrate api.data.gov API key into upstream proxy and enrichment services`).

[NHTSA](https://www.nhtsa.gov/) is the National Highway Traffic Safety Administration. [vPIC](https://vpic.nhtsa.dot.gov/) is NHTSA's Product Information Catalog and Vehicle Listing. A [VIN](https://www.nhtsa.gov/vin-decoder) is a vehicle identification number.

## Open issues

Eight issues are open. None use `status:blocked`. Milestone fields are empty because no milestone exists on the repository yet.

| Issue | Labels | Proposed milestone |
| :-- | :-- | :-- |
| [#7](https://github.com/AIKitLLC/nhtsa-edge-api/issues/7) Adopt Tony's agent and architecture standards | `type:chore`, `status:in-review`, `priority:p1` | none |
| [#8](https://github.com/AIKitLLC/nhtsa-edge-api/issues/8) Bundle an offline copy of NHTSA safety recalls | `type:feature`, `area:pipeline`, `area:routes`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#9](https://github.com/AIKitLLC/nhtsa-edge-api/issues/9) Serve the full [EPA](https://www.epa.gov/) (Environmental Protection Agency) and [DOE](https://www.energy.gov/) (Department of Energy) fuel-economy dataset | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#10](https://github.com/AIKitLLC/nhtsa-edge-api/issues/10) Add NHTSA complaints and [NCAP](https://www.nhtsa.gov/ratings) (New Car Assessment Program) crash-test ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M2 Dataset completeness |
| [#11](https://github.com/AIKitLLC/nhtsa-edge-api/issues/11) Add [United Kingdom](https://www.gov.uk/) [DVSA](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency) (Driver and Vehicle Standards Agency) [MOT](https://www.gov.uk/getting-an-mot) (Ministry of Transport test) history | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#12](https://github.com/AIKitLLC/nhtsa-edge-api/issues/12) Add the Australian Green Vehicle Guide | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#13](https://github.com/AIKitLLC/nhtsa-edge-api/issues/13) Add [Euro NCAP](https://www.euroncap.com/) ratings | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | M3 Further public datasets |
| [#14](https://github.com/AIKitLLC/nhtsa-edge-api/issues/14) Refresh the parity figure in `HANDOFF.md` | `type:docs`, `area:docs`, `status:ready`, `priority:p2` | none |

Euro NCAP in #13 is a separate program from NHTSA NCAP in #10.

Issue #14's body still says `HANDOFF.md` quotes 95.4% live parity. On `main`, commit `53dc681` already sets that sentence to 93.6% for the 2026-10-03 run. The issue stays open until someone closes it. This pull request does not close it.

## Open pull requests

| Pull request | Branch | Linked issue |
| :-- | :-- | :-- |
| [#6](https://github.com/AIKitLLC/nhtsa-edge-api/pull/6) Adopt agent standards, architecture map, and arcade-agent CI (continuous integration) | `cursor/dev-standards-67a5` | [Closes #7](https://github.com/AIKitLLC/nhtsa-edge-api/issues/7) |

Merged, not open: [#5](https://github.com/AIKitLLC/nhtsa-edge-api/pull/5) (rate limit, [OpenAPI](https://www.openapis.org/) description, `/docs`, `llms.txt`, batch page, comparison doc), #4 naming, #3 workers.dev address, #2 website, #1 offline decoder.

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

The last green pair on this branch before the rebase onto `aa309df` was commit `1573bcc` on 2026-10-10: [CI run 38080104249](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38080104249) and [Architecture run 38080104252](https://github.com/AIKitLLC/nhtsa-edge-api/actions/runs/38080104252). Both concluded `success`. Those runs do not include `main` through `aa309df`. The checks on the head of pull request #6 after this update are the ones that count.

Deploy production, the weekly vPIC data refresh, and the Cloudflare check workflow do not run on this pull request. They stay manual or on their own triggers. This change does not deploy.

## Known blockers

- No issue is `status:blocked`.
- Milestones are not created, so #8 through #13 are not on a milestone yet.
- Production deploy stays manual. Agents do not deploy, do not run `wrangler login`, and do not read or write Cloudflare secrets, including `DATA_GOV_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
- `HANDOFF.md` says the unbound [D1](https://developers.cloudflare.com/d1/) database `nhtsa-db` can be deleted. D1 is Cloudflare's relational database. That is a Cloudflare account change. Agents do not do it.

## Next steps

1. Review pull request #6. Merge only with Tony's approval. Merging it closes #7.
2. Create milestones M1, M2, and M3, then assign #8–#10 to M2 and #11–#13 to M3.
3. Close #14, or rewrite its body, after confirming `HANDOFF.md` already says 93.6%.
4. Leave deploy and secrets alone.
