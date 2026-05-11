# Cross-Agent User Lessons

Use this reference when a session produces durable lessons about Aaron's preferences, synthesis style, or agent-operating expectations that should benefit Hermes, Claude Code, Codex, and GBrain agents.

## Decision pattern

Prefer a layered write, not only runtime memory:

1. **Runtime memory** only for compact facts that should be injected into future sessions.
2. **GBrain/vault prompt page** for reusable guidance future agents should retrieve, cite, and build on.
3. **Implementation skill pointer** when the lesson came from a specific automation or workflow, so agents loading that skill find the durable GBrain page.
4. **Changelog entry** when a Hermes/GBrain skill, config, or automation behavior changed.

This avoids overfilling memory while making the lesson discoverable to multiple agent runtimes.

## Good target for Aaron-style preferences

For broad preferences about how to summarize, advise, or synthesize for Aaron, create or update a page under:

```text
/Users/aaron.nam/Desktop/Repos/obsidian-aaron/_gbrain-seeds/prompts/
```

Example from the X-bookmark digest refinement:

```text
_gbrain-seeds/prompts/aaron-signal-distillation.md
```

That page captures the cross-agent preference layer; the X-bookmark Hermes skill remains the implementation runbook.

## Verification checklist

After creating/updating the prompt page:

1. Run frontmatter validation on each changed vault file. Do not assume multiple positional file args validate all files; verify the JSON `target`/`total_files` or run files separately.
2. Import or sync the affected vault path into GBrain when future-agent retrieval matters:

```bash
gbrain import /Users/aaron.nam/Desktop/Repos/obsidian-aaron/_gbrain-seeds/prompts --no-embed
```

3. Confirm retrieval:

```bash
gbrain search "<new prompt title>"
```

4. Patch any relevant implementation skill to point at the GBrain prompt page.
5. Log Hermes/GBrain skill/config changes in `99_Claude-Code/02-hermes-gbrain-changelog.md`.

## Pitfall

Do not preserve broad Aaron preferences only inside a narrow automation skill. That helps future agents who load that one skill, but misses Claude Code/Codex/GBrain sessions that search the vault or need the preference outside the original automation.