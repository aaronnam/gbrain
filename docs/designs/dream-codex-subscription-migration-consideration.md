# Dream synthesis: Anthropic API → subscription-backed Codex consideration

Date: 2026-05-10
Status: consideration / brainstorming only
Owner: Aaron Nam

## Takeaway

There is likely an elegant way to reduce Anthropic API spend, but it is **not** a config-only model swap.

Current GBrain dream synthesis is still Anthropic-shaped in two places:

1. `src/core/cycle/synthesize.ts` runs a Haiku significance judge, then fans out worth-processing transcripts.
2. `src/core/minions/handlers/subagent.ts` runs Sonnet subagents and expects Anthropic Messages API content/tool-use blocks.

So `gbrain config set dream.synthesize.model gpt-5.5` would not be sufficient. The code would still construct Anthropic clients and expect Anthropic tool semantics.

## Current behavior observed

From the current GBrain implementation:

- The synthesize phase reads from `dream.synthesize.session_corpus_dir`.
- It runs a cheap Haiku significance verdict, cached in `dream_verdicts`.
- It dispatches one Sonnet `subagent` job per worth-processing transcript.
- Subagents use `brain_put_page`; GBrain executes the tool and records tool executions, then the orchestrator reverse-writes DB pages to markdown.
- Defaults currently are:
  - synthesis model: `claude-sonnet-4-6`
  - verdict model: `claude-haiku-4-5-20251001`
  - cooldown default: 12 hours unless configured.

Important: this is a controlled server-side tool-execution path. The model proposes writes; GBrain executes `brain_put_page` under slug allowlists. Do not replace this with arbitrary Codex shell access unless intentionally accepting a larger safety surface.

## Upstream-relevant direction

The clean design is a provider-neutral dream LLM abstraction, not a Hermes-specific hard fork.

Candidate interface:

```ts
interface DreamLLMClient {
  create(params: {
    model: string;
    system?: string | Array<unknown>;
    messages: Array<unknown>;
    tools?: Array<unknown>;
    max_tokens?: number;
  }, opts?: { signal?: AbortSignal }): Promise<AnthropicLikeMessage>;
}
```

Adapters:

1. **Anthropic adapter** — preserves current behavior and stays default.
2. **Command/helper adapter** — invokes a local helper via stdin/stdout JSON, so a local machine can route to Hermes/OpenAI-Codex without GBrain knowing about Hermes internals.
3. **Future OpenAI Responses adapter** — optional direct provider path if/when OAuth/subscription constraints are solved cleanly upstream.

Helper contract sketch:

```json
{
  "model": "gpt-5.5",
  "system": "...",
  "messages": [ ... ],
  "tools": [ ... ],
  "max_tokens": 4096
}
```

Output should be normalized back into the tool/text block shape GBrain expects, for example:

```json
{
  "content": [
    { "type": "text", "text": "..." },
    { "type": "tool_use", "id": "...", "name": "brain_put_page", "input": { ... } }
  ],
  "usage": {
    "input_tokens": 123,
    "output_tokens": 456,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  },
  "stop_reason": "end_turn"
}
```

## Why helper over direct Codex CLI

A helper is safer and more upstreamable because:

- GBrain still owns `brain_put_page` execution.
- Existing slug allowlists remain authoritative.
- Existing DB ledger tables remain useful:
  - `subagent_messages`
  - `subagent_tool_executions`
  - `minion_jobs`
- Prompt payloads can be passed via stdin or a temp file, not argv.
- Anthropic remains the default provider, avoiding regressions for upstream users.

## Local Aaron setup idea

Aaron's Hermes route already works with:

```sh
hermes chat -q 'Reply exactly: codex ok' \
  --provider openai-codex \
  -m gpt-5.5 \
  -Q \
  --toolsets ''
```

Observed result: `codex ok`.

A local bridge could wrap that working provider path, but should not expose or bake in any auth credentials. Treat all Codex/OpenAI/Hermes auth files as secrets.

## Cost estimate from current observed run

Observed GBrain DB state for the recent dream synthesis run:

- `minion_jobs`: 25 completed `subagent` jobs in the last observed dream sequence.
- `subagent_messages`: model `claude-sonnet-4-6` across those 25 jobs.
- Sonnet token totals:
  - input tokens: 2,759,485
  - output tokens: 84,366
  - cache read tokens: 1,088,106
  - cache create tokens: 1,321,877
- `dream_verdicts`: 68 verdicts, 29 marked worth processing.

Using assumed Anthropic API rates for Sonnet-class pricing:

- input: $3.00 / 1M tokens
- output: $15.00 / 1M tokens
- cache write/create: $3.75 / 1M tokens
- cache read: $0.30 / 1M tokens

Estimated Sonnet synthesis cost:

| Component | Tokens | Rate | Estimated cost |
|---|---:|---:|---:|
| Input | 2,759,485 | $3.00 / 1M | $8.28 |
| Output | 84,366 | $15.00 / 1M | $1.27 |
| Cache read | 1,088,106 | $0.30 / 1M | $0.33 |
| Cache create | 1,321,877 | $3.75 / 1M | $4.96 |
| **Subtotal** |  |  | **$14.83** |

Verdict judge estimate:

- The Haiku verdict path truncates each transcript to roughly 8K chars max before judging.
- Current cache shows 68 verdicts. With missing/moved source files estimated at the same cap, the verdict judge is roughly 0.14M input tokens plus small JSON outputs.
- At Haiku-like pricing, this is likely **well under $0.25** for the observed run.

Practical estimate:

> A full current nightly dream sequence costs roughly **$15** when it processes a backlog like the observed run.

If run nightly at that size:

- Daily: ~$15
- 30 days: ~$450/month

That is the right order of magnitude for why this feels too expensive.

## Immediate cost controls while analyzing

Before implementing the provider bridge, the lowest-risk controls are:

```sh
gbrain config set dream.synthesize.cooldown_hours 24
```

or temporarily:

```sh
gbrain config set dream.synthesize.enabled false
```

Note: `--dry-run` is not zero-cost today; it still runs the Haiku verdict judge on cache misses.

## Open questions before executing anything

1. Does Aaron want Codex/GPT-5.5 only for Sonnet synthesis, or also for the Haiku verdict judge?
2. Is the target a local-only patch or an upstream PR?
3. Should cost caps be added regardless of provider, e.g. max transcripts/night or max estimated input chars/night?
4. Should GBrain add a first-class cost report command using `subagent_messages` token counters?

## Recommended next brainstorm

Design a minimal provider abstraction that leaves all GBrain orchestration intact:

- Add `DreamLLMClient` + `AnthropicDreamLLMClient`.
- Add `CommandDreamLLMClient` with stdin/stdout JSON.
- Refactor only `judgeSignificance` and the subagent handler to call the abstraction.
- Keep Anthropic defaults.
- Add tests for Anthropic default, command helper, stdin payload, tool-use normalization, and token accounting.

This should let Aaron test subscription-backed Codex/GPT-5.5 locally while keeping the architecture upstreamable.
