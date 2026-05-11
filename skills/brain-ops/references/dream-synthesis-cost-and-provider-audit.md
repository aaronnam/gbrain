# Dream synthesis cost and provider audit pattern

Use this when Aaron asks whether GBrain `dream` is expensive, whether Anthropic can be replaced, or how current dream runs work.

## Key findings from the 2026-05-10 audit

Current dream synthesis was not a config-only model swap:

- `src/core/cycle/synthesize.ts` runs a Haiku significance judge and then dispatches worth-processing transcripts.
- `src/core/minions/handlers/subagent.ts` runs Sonnet subagents and expects Anthropic Messages API content/tool-use blocks.
- `dream.synthesize.model = gpt-5.5` alone is insufficient because the code still constructs Anthropic clients and expects Anthropic-shaped tool blocks.
- Safer migration shape: provider-neutral `DreamLLMClient` plus a command/helper adapter; keep GBrain-side `brain_put_page` execution, slug allowlists, DB ledger, and reverse-write orchestration.

## Cost audit commands

Use GBrain's database tables instead of estimating from file sizes when possible. The useful tables are:

- `minion_jobs` — job-level token rollup for `subagent` jobs.
- `subagent_messages` — per-turn token counts, including `tokens_cache_create`.
- `dream_verdicts` — verdict cache, useful for counting Haiku judge calls.

A temporary Bun script can connect through GBrain's own engine config:

```ts
import { loadConfig, toEngineConfig } from '/Users/aaron.nam/gbrain/src/core/config.ts';
import { createEngine } from '/Users/aaron.nam/gbrain/src/core/engine-factory.ts';

const config = loadConfig();
if (!config) throw new Error('No gbrain config');
const engine = await createEngine(toEngineConfig(config));
await engine.connect(toEngineConfig(config));

const msgAgg = await engine.executeRaw<any>(`
  SELECT model,
         count(*)::int AS messages,
         count(DISTINCT job_id)::int AS jobs,
         sum(coalesce(tokens_in,0))::bigint AS tokens_in,
         sum(coalesce(tokens_out,0))::bigint AS tokens_out,
         sum(coalesce(tokens_cache_read,0))::bigint AS tokens_cache_read,
         sum(coalesce(tokens_cache_create,0))::bigint AS tokens_cache_create
    FROM subagent_messages
   GROUP BY model
   ORDER BY model NULLS FIRST
`);

const verdicts = await engine.executeRaw<any>(`
  SELECT date(judged_at) AS day,
         count(*)::int AS verdicts,
         sum(CASE WHEN worth_processing THEN 1 ELSE 0 END)::int AS worth
    FROM dream_verdicts
   GROUP BY 1
   ORDER BY 1
`);

console.log(JSON.stringify({ msgAgg, verdicts }, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
```

Run with:

```sh
bun /tmp/gbrain-dream-cost-query.ts
```

Pitfalls:

- `BrainEngine` may not expose `close()`. Do not assume it exists in throwaway scripts.
- `JSON.stringify` fails on BigInt. Use a replacer: `(_k, v) => typeof v === 'bigint' ? v.toString() : v`.
- Job-level `minion_jobs` includes input/output/cache-read rollups but may not expose cache-create; use `subagent_messages` for full cost.
- `gbrain jobs get <id>` can dump huge prompts; avoid pasting full transcript data into final answers.
- Never log credentials or auth file contents when inspecting Hermes/OpenAI-Codex setup.

## Pricing estimate method

Use current provider pricing when available. If web access fails, label pricing as an assumption and show the formula.

For Sonnet-class pricing assumed in the 2026-05-10 audit:

- input: `$3.00 / 1M tokens`
- output: `$15.00 / 1M tokens`
- cache create/write: `$3.75 / 1M tokens`
- cache read: `$0.30 / 1M tokens`

Formula:

```text
cost = input/1e6*input_rate
     + output/1e6*output_rate
     + cache_create/1e6*cache_create_rate
     + cache_read/1e6*cache_read_rate
```

Example observed totals from 25 subagent jobs:

- input: 2,759,485
- output: 84,366
- cache read: 1,088,106
- cache create: 1,321,877
- estimated Sonnet subtotal: about `$14.83`

Haiku verdict cost is usually much smaller because `judgeSignificance` truncates each transcript to about 8K chars and returns a small JSON verdict.

## Design recommendation for provider migration

Prefer an upstreamable, provider-neutral abstraction:

1. Keep Anthropic adapter as default.
2. Add command/helper adapter using stdin/stdout JSON, not argv.
3. Normalize helper output back into Anthropic-like text/tool blocks.
4. Preserve GBrain server-side tool execution and slug allowlists.
5. Add tests for Anthropic default, command helper, stdin payload, tool-use normalization, and token accounting.

Do **not** recommend direct Codex shell access as the primary design; it bypasses GBrain's controlled `brain_put_page` execution and audit ledger.
