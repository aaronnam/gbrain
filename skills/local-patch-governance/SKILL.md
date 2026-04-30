---
name: local-patch-governance
version: 1.0.0
description: |
  Manage Aaron's local GBrain customizations as durable branch commits instead of
  uncommitted dirty working-tree changes. Use during upgrades, debug sessions,
  or whenever ~/gbrain appears dirty so agents know whether the state is expected
  and how to rebase, preserve, upstream, or reset changes safely.
triggers:
  - "gbrain dirty"
  - "local patches"
  - "local customizations"
  - "upgrade gbrain with local changes"
  - "why is gbrain dirty"
  - "preserve Aaron-specific fixes"
tools:
  - shell
  - git
mutating: true
---

# Local Patch Governance

## Contract

This skill guarantees:
- Aaron-specific GBrain changes are kept as named commits on a durable local branch, not as unexplained working-tree dirtiness.
- Upstream `garrytan/gbrain` remains fetch-only source of truth for product releases.
- Aaron's personal fork `aaronnam/gbrain` is the durable remote backup for local operational patches.
- Future upgrades use `git rebase origin/master` from the local branch instead of blind `git pull`/`reset`.
- Agents can distinguish expected local patches from real breakage.

## Canonical State

Aaron's canonical local install lives at:

```bash
/Users/aaron.nam/gbrain
```

Repository remotes should be:

```bash
origin  https://github.com/garrytan/gbrain.git   # upstream product repo
aaron   https://github.com/aaronnam/gbrain.git   # Aaron's durable local-patch fork
```

The working branch should normally be:

```bash
aaron/v0.23.0-local
```

This branch intentionally sits on top of upstream `origin/master` and carries small, reviewed commits for Aaron-specific behavior.

## Current Local Patch Categories

As of v0.23.0, local commits are expected to cover:

1. **Skill/resolver behavior tuned for Aaron**
   - Resolver phrases such as `who is`, `notes on`, `do we already have notes on`, citation-fixer routing.
   - Skill documentation preserving source precedence, citation behavior, and setup/skillpack gotchas.

2. **Local quality-reporting behavior**
   - `gbrain lint` scope suppression for templates/specs/agent-doc zones.
   - Whole-page markdown fence detection that avoids false positives on embedded code blocks.
   - Orphan reporting split into actionable vs source-like counts.

These are not breakage by themselves. Treat them as expected if committed on the local branch and tests pass.

## Phases

### 1. Inspect before judging dirtiness

```bash
cd /Users/aaron.nam/gbrain
git branch --show-current
git status --short --branch
git log --oneline --decorate -5
git remote -v
```

Interpretation:
- Clean `aaron/v0.23.0-local` ahead of `origin/master` by local commits = healthy.
- Dirty working tree on `aaron/v0.23.0-local` = inspect; it may be an in-progress local patch, not an upgrade failure.
- Dirty working tree on `master` = convert to a branch before further upgrades.

### 2. Preserve any new dirtiness before changing it

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/gbrain-upgrade-backups/$TS"
git diff > "$HOME/gbrain-upgrade-backups/$TS/local-gbrain-diff.patch"
git status --short --branch > "$HOME/gbrain-upgrade-backups/$TS/git-status.txt"
python3 "$HOME/.hermes/scripts/gbrain-upgrade-env-audit.py" --stable > "$HOME/gbrain-upgrade-backups/$TS/hermes-env-before.json"
```

The Hermes env audit is intentionally redacted: it records key names and present/empty/missing status only. Do not copy raw `~/.hermes/.env` into backup bundles.

If DB-touching work is involved, also archive `~/.gbrain` after stopping active writers. Check for foreground `gbrain serve` processes before running DB verification; Claude/cmux sessions can leave `bun /Users/aaron.nam/.bun/bin/gbrain serve` holding the PGLite lock. Stop only the GBrain writer, then remove `.gbrain-lock/lock` only after verifying the recorded PID is no longer alive.

If `git apply --check` fails, inspect whether upstream removed or renamed a locally added path before assuming a content conflict. Example: during the v0.22.4-local → v0.23.0 probe, Aaron's local `skills/local-patch-governance/SKILL.md` existed only on the local branch and `origin/master` no longer had that path, so `git apply --check` failed with `No such file or directory`. Treat that as a port/delete decision: preserve the governance content in the correct current location if still useful, or keep it in Hermes/shared skills, rather than forcing an obsolete path back into upstream.

### 3. Convert real local changes into commits

If changes are intentional:

```bash
git switch aaron/v0.23.0-local 2>/dev/null || git switch -c aaron/v0.23.0-local
git add <coherent file group>
git commit -m "<category>: <short purpose>"
```

Prefer small coherent commits:
- `docs: preserve Aaron-specific skill routing`
- `feat: tune local lint and orphan reporting`
- `docs: document local patch governance`

### 4. Push to Aaron's fork

```bash
git push -u aaron aaron/v0.23.0-local
```

This makes the local patch stack disaster-recoverable and removes reliance on stashes or backup patches.

### 5. Upgrade with rebase, not reset

```bash
cd /Users/aaron.nam/gbrain
git fetch origin master
git rebase origin/master
bun install
bun link
gbrain init
gbrain config set sync.repo_path /Users/aaron.nam/Desktop/Repos/obsidian-aaron
gbrain post-upgrade
gbrain apply-migrations --yes
python3 "$HOME/.hermes/scripts/gbrain-upgrade-env-audit.py" --stable > "$HOME/gbrain-upgrade-backups/$TS/hermes-env-after.json"
diff -u "$HOME/gbrain-upgrade-backups/$TS/hermes-env-before.json" "$HOME/gbrain-upgrade-backups/$TS/hermes-env-after.json" || true
```

Resolve conflicts by preserving both upstream product changes and Aaron-specific behavior when compatible. Do not `git reset --hard origin/master` unless Aaron explicitly asks to discard local patches.

### 6. Verify after rebase or commit

Minimum checks:

```bash
bun test test/lint.test.ts test/orphans.test.ts test/frontmatter-cli.test.ts test/doctor.test.ts test/dream-cli-flags.test.ts test/cycle-synthesize.test.ts test/cycle-patterns.test.ts
bun run typecheck
gbrain check-resolvable --skills-dir /Users/aaron.nam/gbrain/skills --json
gbrain doctor --json
gbrain stats
gbrain dream --dry-run --json
python3 ~/.hermes/scripts/gbrain-check-update.py
```

Expected local PGLite warnings such as `pgvector` or `jsonb_integrity` are not automatically failures; check the GBrain setup skill for known warnings.

## Output Format

When reporting local patch state, include:

```text
Branch: <branch>
Upstream base: <origin/master commit>
Local commits: <short list>
Working tree: clean | dirty (<files>)
Remote backup: pushed | not pushed (<remote/branch>)
Verification: <commands + pass/fail>
Next action: <rebase | commit | upstream PR | no action>
```

## Anti-Patterns

- Calling committed local patches "broken" only because `~/gbrain` is not identical to upstream.
- Leaving important fixes as uncommitted dirtiness after a successful upgrade.
- Using `git reset --hard origin/master` without first backing up and confirming Aaron wants to discard local behavior.
- Pushing Aaron-specific workflow patches to upstream without separating generic product improvements from personal operational preferences.
- Treating a stash as durable documentation; stashes are temporary safety nets, not governance.

## Upstreaming Guidance

Classify each local patch:

- **Generic product improvement:** open an upstream PR against `garrytan/gbrain`.
- **Aaron-specific operational preference:** keep it on `aaron/v0.23.0-local`.
- **Hermes-specific behavior:** move it to Hermes skills/config instead of GBrain core.

When unsure, preserve locally first, then propose upstream after tests and a concise rationale.
