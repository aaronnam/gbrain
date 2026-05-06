import { beforeEach, afterEach, describe, expect, test } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { runEmbedCore } from '../src/commands/embed.ts';

let engine: PGLiteEngine;

async function addSource(id: string) {
  await engine.executeRaw(
    `INSERT INTO sources (id, name, local_path, config)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [id, id, `/tmp/${id}`, '{"federated":false}'],
  );
}

beforeEach(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});

afterEach(async () => {
  await engine.disconnect();
});

describe('embed source scoping', () => {
  test('embed --stale treats same slug in default and isolated source as distinct pages', async () => {
    const sourceId = 'embed-source-stale';
    const slug = 'same/slug';
    await addSource(sourceId);

    await engine.putPage(slug, {
      type: 'note',
      title: 'Default copy',
      compiled_truth: 'Default stale chunk',
    });
    await engine.upsertChunks(slug, [
      { chunk_index: 0, chunk_text: 'Default stale chunk', chunk_source: 'compiled_truth' },
    ]);

    await engine.putPage(slug, {
      type: 'note',
      title: 'Isolated copy',
      compiled_truth: 'Isolated stale chunk',
      sourceId,
    }, { sourceId });
    await engine.upsertChunks(slug, [
      { chunk_index: 0, chunk_text: 'Isolated stale chunk', chunk_source: 'compiled_truth' },
    ], { sourceId });

    const result = await runEmbedCore(engine, { stale: true, dryRun: true });

    expect(result.would_embed).toBe(2);
    expect(result.total_chunks).toBe(2);
    expect(result.pages_processed).toBe(2);
  });

  test('embed --all fetches chunks from each page source, not default by slug', async () => {
    const sourceId = 'embed-source-all';
    const slug = 'same/slug';
    await addSource(sourceId);

    await engine.putPage(slug, {
      type: 'note',
      title: 'Default copy',
      compiled_truth: 'Default has one chunk',
    });
    await engine.upsertChunks(slug, [
      { chunk_index: 0, chunk_text: 'Default chunk only', chunk_source: 'compiled_truth' },
    ]);

    await engine.putPage(slug, {
      type: 'note',
      title: 'Isolated copy',
      compiled_truth: 'Isolated has two chunks',
      sourceId,
    }, { sourceId });
    await engine.upsertChunks(slug, [
      { chunk_index: 0, chunk_text: 'Isolated chunk one', chunk_source: 'compiled_truth' },
      { chunk_index: 1, chunk_text: 'Isolated chunk two', chunk_source: 'compiled_truth' },
    ], { sourceId });

    const result = await runEmbedCore(engine, { all: true, dryRun: true });

    expect(result.would_embed).toBe(3);
    expect(result.total_chunks).toBe(3);
    expect(result.pages_processed).toBe(2);
  });
});
