# AGENTS.md

How coding agents work in this repository (`nhtsa-edge-api`, the AI Kit Data Worker at https://data.ai-kit.net).

Read this file before changing code. The short copies Cursor cloud agents load on every turn are `.cursor/rules/*.mdc`. They point here.

## Skills to load

Load both skills at the start of a task. The files under `.agents/skills/` are vendored upstream copies. Each file's header records the source URL, commit SHA, and license. The MIT copyright notice is in `LICENSE` next to the skill.

1. **Ponytail** (coding style: YAGNI, reuse, smallest complete diff). Read `.agents/skills/ponytail/SKILL.md`. The Cursor rule adapter is `.agents/skills/ponytail/ponytail.mdc`.
   - Source: https://github.com/DietrichGebert/ponytail
   - Commit: `9b58c1ffb790c075ca32e70a89cf1d80588f4abf`
   - License: MIT, Copyright (c) 2026 DietrichGebert
2. **i-have-adhd** (output style: next action first, numbered steps, lists capped at 5, no preamble or recap). Read `.agents/skills/i-have-adhd/SKILL.md`. The always-on snippet from that repo's `INSTALL.md` is `.cursor/rules/output-style.mdc`.
   - Source: https://github.com/ayghri/i-have-adhd
   - Commit: `723af7d9afaf43eb871dbcce6129e2bf80de90d5`
   - License: MIT, Copyright (c) 2026 Ayoub Ghriss

## Cloudflare skills

This Worker is Hono on Cloudflare Workers, configured with Wrangler, and serves decoder data from Workers Static Assets (`ASSETS` in `wrangler.jsonc`). When a change designs or edits Worker code, bindings, assets, or the public pages, consult these skills from https://github.com/cloudflare/skills at commit `0871daceb347e3c51693fbe9c77555468df7e410`. Reference them. Do not vendor their contents into this repo.

| Skill | Use it when |
| :-- | :-- |
| `skills/wrangler` | `wrangler.jsonc`, local dev, bindings, dry-run bundle |
| `skills/workers-best-practices` | Request path, CPU, static assets, caching |
| `skills/web-perf` | HTML at `/` and `/vpic` |

Durable Objects, D1, R2, and Email are not bindings in this repo. Do not design around them until a change actually needs that product. The optional KV cache (`NHTSA_CACHE_KV`, `ENABLE_KV_CACHE`) is documented in `wrangler.jsonc` and is unbound.

## Architecture

Decouple at real boundaries (domain modules, adapters for external services, platform bindings). No speculative abstractions or single-implementation interfaces.

Modules talk through explicit public entry points. No deep imports across modules.

The current map, the entry points that exist today, and the target boundaries are in `docs/ARCHITECTURE.md`.

Before a large refactor, use the arcade-agent MCP server below: `context_for_task`, then `diff_impact`.

## Workflow

1. Every change has a GitHub issue. Search open issues first and do not file a duplicate.
2. The pull request description contains `Closes #N` for that issue.
3. Update `docs/STATUS.md` in the same pull request (open issues, open PRs, milestones, blockers, and the date).
4. Never merge without Tony's approval. Do not merge your own pull request.
5. Never deploy. Never run `wrangler login`, `wrangler deploy`, or the Deploy production workflow. Never touch cloud accounts or secrets. Never add a paid service.

`docs/STATUS.md` is the live tracker. Labels and issues #7 through #14 exist. The milestones `M1 Foundation`, `M2 Dataset completeness`, and `M3 Further public datasets` are still only a plan in that file. Do not open a duplicate issue.

Keep pull requests additive when other work is open.

## arcade-agent

Language support includes TypeScript, so `.github/workflows/architecture.yml` runs on pull requests. It calls `arcade-agent/arcade-agent/actions/analyze` pinned to commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d` and installs PyPI `arcade-agent==0.4.1`. The job is report-only (`continue-on-error: true`) on a GitHub-hosted runner, with read-only `contents: read` and `actions: read`. It does not post a pull-request comment or upload artifacts, because those steps need write permissions. The job log is the report. There is no second architecture workflow. If this file already exists, update it.

Package and docs: PyPI `arcade-agent`, https://arcade-agent.dev/docs/getting-started/ , source https://github.com/arcade-agent/arcade-agent at the same commit.

### Local MCP

`.cursor/mcp.json` starts the server as:

```bash
uvx --from "arcade-agent[mcp,languages]==0.4.1" arcade-mcp
```

That needs [uv](https://docs.astral.sh/uv/) on the machine. The version matches CI. The server exposes the tools documented in the arcade-agent README, including `context_for_task` and `diff_impact`.

Before a large refactor:

1. Call `context_for_task` with the task in plain language. Read the files it ranks.
2. After editing, call `diff_impact` on the changed paths. Check affected components and downstream dependents, then open the pull request.

The parser writes `.arcade-cache/`. That directory is gitignored.

## Out of scope for agents

- Merging, deploying, and changing DNS or Worker names.
- Reading or writing `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or `.dev.vars`.
- Creating paid Cloudflare resources, or moving the account to Workers Paid. The free-plan CPU limit is Tony's call; it is described in `README.md`.
- Deleting the unbound D1 database `nhtsa-db` mentioned in `HANDOFF.md`. That is a cloud-account change.
