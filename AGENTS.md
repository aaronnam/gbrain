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
3. [`./docs/architecture/brains-and-sources.md`](./docs/architecture/brains-and-sources.md)
   — the two-axis mental model (brain = which DB, source = which repo in the DB). Every
   query routes on both axes. Read before writing anything that touches brain ops.
4. [`./skills/conventions/brain-routing.md`](./skills/conventions/brain-routing.md) —
   agent-facing decision table: when to switch brain, when to switch source, how
   cross-brain federation works (latent-space only; the agent decides).
5. [`./skills/RESOLVER.md`](./skills/RESOLVER.md) — skill dispatcher. Read before any task.

## Aaron's local patch branch (do not misdiagnose as breakage)

Aaron's canonical install may intentionally run on `aaron/v0.23.0-local`, not raw
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

Expected healthy state: clean `aaron/v0.23.0-local` with local commits on top of
`origin/master`, pushed to the `aaron` remote as branch `aaron/v0.23.0-local`. Future upgrades should use
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
- **Eval retrieval changes:** capture is off by default. To benchmark a
  retrieval change against real captured queries, set
  `GBRAIN_CONTRIBUTOR_MODE=1`, then `gbrain eval export --since 7d > base.ndjson`
  and `gbrain eval replay --against base.ndjson`. For public benchmark
  coverage (LongMemEval, ground-truth scoring), `gbrain eval longmemeval
  <dataset.jsonl>` (v0.28.8) runs against an isolated in-memory PGLite
  per question — your `~/.gbrain` is never opened. Full guide:
  [`docs/eval-bench.md`](./docs/eval-bench.md).
- **Everything else:** [`./llms.txt`](./llms.txt) is the full documentation map.
  [`./llms-full.txt`](./llms-full.txt) is the same map with core docs inlined for
  single-fetch ingestion.

## Before shipping

Easiest path: `bun run ci:local` runs the full CI gate inside Docker (gitleaks,
unit tests with `DATABASE_URL` unset, then all 29 E2E files sequentially against a
fresh pgvector container) and tears down. Use `bun run ci:local:diff` for the
diff-aware subset during fast iteration on a focused branch. Requires Docker
(Docker Desktop / OrbStack / Colima) and `gitleaks` (`brew install gitleaks`).

Manual path: `bun test` plus the E2E lifecycle described in `./CLAUDE.md` (spin
up the test Postgres container, run `bun run test:e2e`, tear it down).

Ship via the `/ship` skill, not by hand.

## Privacy

Never commit real names of people, companies, or funds into public artifacts. See the
Privacy rule in `./CLAUDE.md`. GBrain pages reference real contacts; public docs must
use generic placeholders (`alice-example`, `acme-example`, `fund-a`).

## Forks

If you are a fork, regenerate `llms.txt` + `llms-full.txt` with your own URL base before
publishing: `LLMS_REPO_BASE=https://raw.githubusercontent.com/your-org/your-fork/main bun run build:llms`.
