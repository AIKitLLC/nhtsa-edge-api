# Status

Updated in the same pull request as every code or docs change. Last updated: 2026-10-10.

Figures below are from the GitHub API for `AIKitLLC/nhtsa-edge-api` on that date. Default branch: `main`. HEAD on `main`: `2b6ab65` (`data(vpic): vPICList_lite_2026_09 (live parity 93.60%)`).

## Open issues

None.

## Open pull requests

| PR | Branch | Linked issues |
| :-- | :-- | :-- |
| [#6](https://github.com/AIKitLLC/nhtsa-edge-api/pull/6) Adopt agent standards, architecture map, and arcade-agent CI | `cursor/dev-standards-67a5` | None. The standards issue in Tracking setup was not created (HTTP 403), so this pull request cannot say `Closes #N` yet. |
| [#5](https://github.com/AIKitLLC/nhtsa-edge-api/pull/5) Rate limit, OpenAPI + /docs + llms.txt, batch page, comparison doc | `claude/exciting-pascal-8khdrj` | None. The body does not contain `Closes #N` or `Fixes #N`. No open issue matches that work, so no comment was added. |

Merged history (not open): #1 offline decoder, #2 website, #3 workers.dev URL, #4 AI Kit Data naming.

## Milestones

None on the repository.

## Known blockers

- Cloud agents cannot create labels, milestones, or issues: `POST /repos/AIKitLLC/nhtsa-edge-api/labels` returned HTTP 403 `Resource not accessible by integration` on 2026-10-10. The token's repository permissions are all false (`admin`, `maintain`, `push`, `triage`, `pull`). The tracking set is in the next section. It was not applied.
- Nothing in GitHub is `status:blocked`.
- Production deploy is manual (`Deploy production` workflow, or `pnpm deploy`) and stays that way. Agents do not deploy.
- `HANDOFF.md` still says live parity 95.4%. Commit `2b6ab65` says 93.60%. Proposed docs issue below.
- `HANDOFF.md` says the unbound D1 database `nhtsa-db` can be deleted. That is a Cloudflare account change. Agents do not do it.

## Tracking setup

Apply this with an account that can administer the repository. Create missing labels only. Do not delete existing labels (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`). Do not close or rewrite issues. Search before creating an issue so these titles are not duplicated.

### Labels

| Label | Meaning |
| :-- | :-- |
| `type:feature` | New behavior |
| `type:bug` | Defect |
| `type:chore` | Tooling, process, or maintenance |
| `type:docs` | Docs only |
| `area:vpic` | `src/vpic` |
| `area:routes` | `src/routes` |
| `area:services` | `src/services` |
| `area:enrichment` | `src/enrichment` |
| `area:validation` | `src/validation` |
| `area:pipeline` | `scripts/vpic` |
| `area:data` | `data/vpic` |
| `area:platform` | Worker entry, middleware, config, types, `wrangler.jsonc` |
| `area:docs` | `docs/`, `README.md`, `HANDOFF.md` |
| `status:ready` | Can be picked up |
| `status:in-progress` | Someone is doing it |
| `status:in-review` | Pull request open |
| `status:blocked` | Waiting on a named blocker |
| `priority:p0` | Production broken or data wrong |
| `priority:p1` | Next product or process gap |
| `priority:p2` | Planned, not urgent |

`area:*` matches the modules in `docs/ARCHITECTURE.md`, plus `area:docs` for the docs tree.

### Milestones

No open issues existed to hang a milestone on. This set follows the hub and `HANDOFF.md`.

| Milestone | Description |
| :-- | :-- |
| `M1 Foundation` | Offline vPIC decoder, dataset hub, weekly git-tracked data, dev deploy. Shipped on `main`. No open issues to assign. |
| `M2 Dataset completeness` | Datasets the hub already marks partial or planned: offline recalls, full fuel economy, complaints and NCAP. |
| `M3 Further public datasets` | Enrichment sources named only in `HANDOFF.md`: UK DVSA MOT, Australian Green Vehicle Guide, Euro NCAP. |

### Issues to create

No `TODO` or `FIXME` comments in the source. `XXX` in `src/vpic` is the vPIC placeholder value, not a task. Each row is one issue that has no GitHub issue yet.

| Title | Body | Labels | Milestone |
| :-- | :-- | :-- | :-- |
| Adopt Tony's agent and architecture standards | Add `AGENTS.md`, vendored ponytail and i-have-adhd skills, architecture and status docs, and the report-only arcade-agent workflow. | `type:chore`, `status:in-review`, `priority:p1` | — |
| Bundle an offline copy of NHTSA safety recalls | Recalls are proxied and cached; the hub says an offline copy is planned. | `type:feature`, `area:pipeline`, `area:routes`, `status:ready`, `priority:p2` | `M2 Dataset completeness` |
| Serve the full EPA and DOE fuel-economy dataset | Unified profiles carry model-level FuelEconomy.gov data; the hub says the full dataset is planned. | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | `M2 Dataset completeness` |
| Add NHTSA complaints and crash-test ratings | Owner complaints and NCAP star ratings by make, model, and year (hub dataset `complaints-ncap`, status planned). | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | `M2 Dataset completeness` |
| Add UK DVSA MOT history | `HANDOFF.md` lists UK DVSA MOT history as a further enrichment. | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | `M3 Further public datasets` |
| Add the Australian Green Vehicle Guide | `HANDOFF.md` lists the Australian Green Vehicle Guide as a further enrichment. | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | `M3 Further public datasets` |
| Add Euro NCAP ratings | `HANDOFF.md` lists Euro NCAP ratings as a further enrichment. | `type:feature`, `area:enrichment`, `status:ready`, `priority:p2` | `M3 Further public datasets` |
| Refresh the parity figure in HANDOFF.md | `HANDOFF.md` says 95.4% live parity; data commit `2b6ab65` reports 93.60%. | `type:docs`, `area:docs`, `status:ready`, `priority:p2` | — |

The standards row is the issue for pull request #6. When that issue exists, the pull request description should say `Closes #N`. It was not opened: the token got HTTP 403, and a trial issue was not created.

Existing open issues to label: none.
