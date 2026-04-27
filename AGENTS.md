# Agents working on GBrain

This is your install + operating protocol. Claude Code reads `./CLAUDE.md` automatically.
Everyone else (Codex, Cursor, OpenClaw, Aider, Continue, or an LLM fetching via URL):
start here.

## Install (5 min)

1. Clone: `git clone https://github.com/garrytan/gbrain ~/gbrain && cd ~/gbrain`
2. Install: `bun install`
3. Init the brain: `gbrain init` (defaults to PGLite, zero-config). For 1000+ files or
   multi-machine sync, init suggests Postgres + pgvector via Supabase.
4. Read [`./INSTALL_FOR_AGENTS.md`](./INSTALL_FOR_AGENTS.md) for the full 9-step flow
   (API keys, identity, cron, verification).

## Read this order

1. `./AGENTS.md` (this file) — install + operating protocol.
2. [`./CLAUDE.md`](./CLAUDE.md) — architecture reference, key files, trust boundaries,
   test layout.
3. [`./skills/RESOLVER.md`](./skills/RESOLVER.md) — skill dispatcher. Read before any task.

## Aaron's local patch branch (do not misdiagnose as breakage)

Aaron's canonical install may intentionally run on `aaron/v0.22.4-local`, not raw
`origin/master`. `origin` is upstream `garrytan/gbrain`; `aaron` is Aaron's fork
`aaronnam/gbrain` for durable local operational patches. Local commits currently
preserve Aaron-specific skill routing plus lint/orphan reporting behavior.

If `/Users/aaron.nam/gbrain` appears dirty or ahead of upstream, **do not reset it**
and do not assume GBrain is broken. First read
[`skills/local-patch-governance/SKILL.md`](./skills/local-patch-governance/SKILL.md),
then inspect:

```bash
cd /Users/aaron.nam/gbrain
git branch --show-current
git status --short --branch
git log --oneline --decorate -5
git remote -v
```

Expected healthy state: clean `aaron/v0.22.4-local` with local commits on top of
`origin/master`, pushed to the `aaron` remote as branch `aaron/v0.22.4-local`. Future upgrades should use
`git fetch origin master && git rebase origin/master`, then `bun install`, `bun link`,
`gbrain init`, `gbrain post-upgrade`, `gbrain apply-migrations --yes`, and the focused
verification suite. Use `git reset --hard origin/master` only if Aaron explicitly asks
to discard local behavior.

## Trust boundary (critical)

GBrain distinguishes **trusted local CLI callers** (`OperationContext.remote = false`,
set by `src/cli.ts`) from **untrusted agent-facing callers** (`remote = true`, set by
`src/mcp/server.ts`). Security-sensitive operations like `file_upload` tighten filesystem
confinement when `remote = true` and default to strict behavior when unset. If you are
writing or reviewing an operation, consult `src/core/operations.ts` for the contract.

## Common tasks

- **Configure:** [`docs/ENGINES.md`](./docs/ENGINES.md),
  [`docs/guides/live-sync.md`](./docs/guides/live-sync.md),
  [`docs/mcp/DEPLOY.md`](./docs/mcp/DEPLOY.md).
- **Debug:** [`docs/GBRAIN_VERIFY.md`](./docs/GBRAIN_VERIFY.md),
  [`docs/guides/minions-fix.md`](./docs/guides/minions-fix.md), `gbrain doctor --fix`.
- **Migrate:** [`docs/UPGRADING_DOWNSTREAM_AGENTS.md`](./docs/UPGRADING_DOWNSTREAM_AGENTS.md),
  [`skills/migrations/`](./skills/migrations/), `gbrain apply-migrations`.
- **Everything else:** [`./llms.txt`](./llms.txt) is the full documentation map.
  [`./llms-full.txt`](./llms-full.txt) is the same map with core docs inlined for
  single-fetch ingestion.

## Before shipping

Run `bun test` plus the E2E lifecycle described in `./CLAUDE.md` (spin up the test
Postgres container, run `bun run test:e2e`, tear it down). Ship via the `/ship` skill,
not by hand.

## Privacy

Never commit real names of people, companies, or funds into public artifacts. See the
Privacy rule in `./CLAUDE.md`. GBrain pages reference real contacts; public docs must
use generic placeholders (`alice-example`, `acme-example`, `fund-a`).

## Forks

If you are a fork, regenerate `llms.txt` + `llms-full.txt` with your own URL base before
publishing: `LLMS_REPO_BASE=https://raw.githubusercontent.com/your-org/your-fork/main bun run build:llms`.
