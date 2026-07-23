# AGENTS.md — Macphisto Enterprises Paperclip Fork

Guidance for human and AI contributors working in this repository.

## Where Were We (WWW) — session handoff

> **How to use this section:** When Billy types **"www"** or **"where were we"**, read this section back and summarize it. When Billy says **"save"** or **"wrap up"**, overwrite this whole section with the current state. Replace old content, never append. Keep it tight.

**Last session:** 2026-07-23

**Done (recently finished):**
- Fork created at `brovzar-lab/macphisto-paperclip`, branch `macphisto`. Clean: only `master` + `macphisto` (644 inherited branches deleted).
- Local dev server running at `http://127.0.0.1:3100` (embedded PGlite, `local_trusted` mode for loopback; `authenticated` mode for remote access).
- Company **Macphisto Enterprises** created (ID: `93037322-e94f-4089-88c1-66e9f041dd34`, prefix: `MAC`).
- Remote access via Cloudflare Tunnel + Tailscale Funnel configured. Board claimed by `billyrovzar@gmail.com`.
- Paperclip Expert skills installed in Hermes (`~/.hermes/skills/paperclip-expert/`).
- Config: `BETTER_AUTH_SECRET=paperclip-dev-secret` in `~/.paperclip/instances/default/.env`.
- Agent business brainstorming session completed — 4 ideas (SEO Affiliate, FBA Arbitrage, Digital Funnel, Etsy POD) documented in HTML artifact.

**In progress:**
- Nothing mid-flight. Branch `macphisto` HEAD matches upstream master + AGENTS.md customizations.

**Next up:**
1. Design and create the first Macphisto Enterprises agent in Paperclip
2. Decide which business idea to pursue first
3. Set up skills for the chosen business

**Open questions / blockers:**
- None. Server runs, company exists, board claimed, fork is clean.

---

## What This Is

This is a **fork** of `paperclipai/paperclip` for **Macphisto Enterprises**. The fork lives at `brovzar-lab/macphisto-paperclip` on branch `macphisto`.

This is a **local-only development instance** — it runs on Billy's Mac, not on a VPS. There is no production server, no Docker, no cloud deployment.

---

## Working with Billy — communication rules

Billy is non-technical and runs commands by copy-pasting from chat into a terminal. He communicates via Telegram and sometimes switches between devices.

**Rules:**
1. State explicitly where each command should run (Mac terminal vs something else).
2. Don't tell him to "verify" without giving the exact command to paste.
3. He cannot translate intent into shell commands — spell out every step.
4. Billy's Mac prompt looks like `quantumcode@Quantums-MacBook-Pro ~ %`. If you see that, he's on the Mac.

---

## Critical Mental Model: Code vs Data

```
SOURCE CODE (this repo)          DATABASE DATA (local disk)
━━━━━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
.tsx, .ts, config files           Agents, companies, skills,
                                  tasks, conversations, runs
↓                                 ↓
git push → GitHub fork            ~/.paperclip/instances/default/
                                  git NEVER touches this

Git only tracks source code. It cannot and will never touch
the local database or any agent/company data.
```

---

## Infrastructure Map

| What | Value |
|---|---|
| Fork URL | https://github.com/brovzar-lab/macphisto-paperclip |
| Local repo | `/Users/macphisto/projects/paperclip` |
| Dev URL (loopback) | http://127.0.0.1:3100 |
| Dev URL (Tailscale) | https://macphistos-macbook-pro.taild1d4e0.ts.net |
| Dev URL (Cloudflare) | `cloudflared tunnel --url http://127.0.0.1:3100` (generates trycloudflare.com URL) |
| Local DB | `~/.paperclip/instances/default/db` (embedded PGlite) |
| Local config | `~/.paperclip/instances/default/config.json` |
| Local env | `~/.paperclip/instances/default/.env` |
| Company | Macphisto Enterprises (`93037322-e94f-4089-88c1-66e9f041dd34`, prefix `MAC`) |
| Remote `origin` | `paperclipai/paperclip` (upstream — pull from, never push to) |
| Remote `macphisto` | `brovzar-lab/macphisto-paperclip` (our fork — push here) |

---

## GitHub Repos

| Repo | Purpose |
|---|---|
| `brovzar-lab/macphisto-paperclip` branch `macphisto` | Source code — where all development happens |
| `brovzar-lab/macphisto-paperclip` branch `master` | Clean upstream mirror — never commit here |
| `paperclipai/paperclip` remote `origin` | Upstream source — pull from, never push to |

---

## Dev Workflow

### Start the server

```bash
cd /Users/macphisto/projects/paperclip
pnpm dev
# → http://127.0.0.1:3100
```

For remote access (authenticated mode + LAN bind):
```bash
cd /Users/macphisto/projects/paperclip
export BETTER_AUTH_SECRET=paperclip-dev-secret
pnpm dev
# → edit ~/.paperclip/instances/default/config.json to set deploymentMode: "authenticated", bind: "lan", host: "0.0.0.0"
```

For Cloudflare quick tunnel (public HTTPS, no auth needed):
```bash
cloudflared tunnel --url http://127.0.0.1:3100
# → prints a trycloudflare.com URL
```

### Reset local DB
```bash
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

### Kill all Paperclip processes
```bash
pkill -f "tsx.*index.ts"
```

### Push changes
```bash
cd /Users/macphisto/projects/paperclip
git add -A
git commit -m "feat: describe change"
git push macphisto macphisto
```

---

## Pull Upstream Updates (cherry-pick only — NEVER bulk merge)

> **⚠️ CRITICAL RULE:** Never run `git merge upstream/master` or `git merge origin/master` into `macphisto`. A bulk merge can silently overwrite custom features, migrations, and configuration with upstream's versions. Lemon Virtual Studios learned this the hard way on 2026-05-30 when a merge destroyed their entire project lifecycle engine. Cherry-pick only. Always.

```bash
git fetch origin
git log --oneline origin/master --not macphisto | head -30
# ↑ Show this list to Billy. He decides what to bring in.
# For each approved commit:
git cherry-pick <commit-hash>
pnpm build && pnpm test:run
git push macphisto macphisto
```

---

## What to Never Do

- **NEVER merge, rebase, or bulk-import upstream into `macphisto`** — not `git merge`, not `git rebase master`, not any bulk operation. Cherry-pick individual commits only, and only after Billy approves.
- Do not commit to `master` — it is a clean upstream mirror only.
- Do not push database files, `.paperclip/` directories, or any data to git.
- Do not rename existing migration files — Drizzle tracks applied migrations by SHA-256 hash.
- Do not hardcode secrets (API keys, tokens, passwords) in any file committed to git. Use `.env` files.

---

## DB Migration Notes (when adding custom features)

- Upstream migrations belong to upstream. Do not modify them.
- Custom Macphisto migrations start at `0050` and increment (same convention as Lemon).
- Use idempotent SQL: `IF NOT EXISTS`, `DO $$ EXCEPTION` blocks.
- Never reuse or skip a migration number.
- Migrations auto-apply on server startup — no manual step needed.

---

## Hermes Adapter (built-in)

This fork ships `hermes_local` and `hermes_gateway` as built-in core adapters (from the HenkDz/paperclip heritage, branch `feat/externalize-hermes-adapter`).

- `hermes_local` runs the local Hermes CLI for agent heartbeats.
- `hermes_gateway` calls an already-running Hermes API server.
- Operators may install external Hermes packages through Adapter manager to override/shadow the built-ins.

---

## Original AGENTS.md (upstream)

The sections below are the original upstream AGENTS.md from `paperclipai/paperclip`. They remain the authoritative reference for general Paperclip development practices.

### Purpose

Paperclip is a control plane for AI-agent companies. The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

### Read This First

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

### Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `doc/`: operational and product docs

### Core Engineering Rules

1. Keep changes company-scoped. Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.
2. Keep contracts synchronized. If you change schema/API behavior, update all impacted layers: `packages/db`, `packages/shared`, `server`, `ui`.
3. Preserve control-plane invariants: single-assignee task model, atomic issue checkout semantics, approval gates for governed actions, budget hard-stop auto-pause behavior, activity logging for mutating actions.
4. Do not replace strategic docs wholesale unless asked. Prefer additive updates.
5. Keep plan docs dated and centralized in `doc/plans/` using `YYYY-MM-DD-slug.md` filenames.
6. Attach inspectable generated artifacts via the Paperclip skill's artifact upload workflow.

### Database Change Workflow

```sh
# 1. Edit packages/db/src/schema/*.ts
# 2. Export new tables from packages/db/src/schema/index.ts
# 3. Generate migration:
pnpm db:generate
# 4. Validate:
pnpm -r typecheck
```

### Verification Before Hand-off

```sh
pnpm test                 # Vitest suite (fast, default)
pnpm -r typecheck         # TypeScript typecheck all packages
pnpm test:run             # Full test suite
pnpm build                # Full build
```

### API and Auth Expectations

- Base path: `/api`
- Board access = full-control operator context
- Agent access = bearer API keys, hashed at rest
- Agent keys must not access other companies
- Apply company access checks, enforce actor permissions, write activity log entries, return consistent HTTP errors

### Pull Request Requirements

When creating a PR, fill every section of `.github/PULL_REQUEST_TEMPLATE.md`: Thinking Path, What Changed, Verification, Risks, Model Used, Checklist.

### Definition of Done

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts synced across db/shared/server/ui
4. Docs updated when behavior changes
5. PR description follows the PR template

### Design System

`DESIGN.md` at repo root is the source of truth for UI design decisions. Run `pnpm check:token-gates` before committing UI changes.
