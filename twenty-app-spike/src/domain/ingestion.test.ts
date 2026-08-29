import { describe, expect, it } from 'vitest';

import { MemoryCoreStore } from 'src/__tests__/memory-core-store';
import {
  ingestSingleFixture,
  IngestionInvariantError,
  processStressPage,
} from 'src/domain/ingestion';
import {
  buildStressPagePayload,
  buildStressSource,
  buildSyncRun,
  STRESS_FIXTURE_ID,
  STRESS_RECORD_COUNT,
  STRESS_PAGE_SIZE,
} from 'src/domain/synthetic-fixture';

const seedStressRun = async (store: MemoryCoreStore) => {
  const source = buildStressSource();
  const run = buildSyncRun({
    fixtureId: STRESS_FIXTURE_ID,
    sourceId: source.id,
    expectedCount: STRESS_RECORD_COUNT,
    triggerKind: 'UNIT_TEST',
    startedAt: '2026-08-29T00:00:00.000Z',
  });

  await store.upsertKnowledgeSource(source);
  await store.upsertSyncRun(run);

  return run;
};

describe('bounded ingestion semantics', () => {
  it('replays the single fixture without duplicate logical records', async () => {
    const store = new MemoryCoreStore();

    const first = await ingestSingleFixture({
      store,
      now: '2026-08-29T00:00:00.000Z',
    });
    const second = await ingestSingleFixture({
      store,
      now: '2026-08-29T00:01:00.000Z',
    });

    expect(second).toEqual(first);
    expect(store.sources.size).toBe(1);
    expect(store.runs.size).toBe(1);
    expect(store.documents.size).toBe(1);
    expect(store.runs.get(first.runId)).toMatchObject({
      status: 'COMPLETED',
      cursor: 1,
      processedCount: 1,
    });
  });

  it('completes 1,000 records page-by-page with one logical record each', async () => {
    const store = new MemoryCoreStore();
    const run = await seedStressRun(store);

    for (
      let cursor = 0;
      cursor < STRESS_RECORD_COUNT;
      cursor += STRESS_PAGE_SIZE
    ) {
      await processStressPage({
        store,
        payload: buildStressPagePayload(cursor),
        now: '2026-08-29T00:10:00.000Z',
      });
    }

    const replay = await processStressPage({
      store,
      payload: buildStressPagePayload(900),
      now: '2026-08-29T00:11:00.000Z',
    });

    expect(replay).toMatchObject({ completed: true, replayed: true });
    expect(store.documents.size).toBe(STRESS_RECORD_COUNT);
    expect(
      new Set([...store.documents.values()].map((d) => d.logicalKey)).size,
    ).toBe(STRESS_RECORD_COUNT);
    expect(store.runs.get(run.id)).toMatchObject({
      status: 'COMPLETED',
      cursor: STRESS_RECORD_COUNT,
      processedCount: STRESS_RECORD_COUNT,
    });
  });

  it('does not advance a checkpoint on a partial page failure and safely retries', async () => {
    const store = new MemoryCoreStore();
    const run = await seedStressRun(store);
    store.failAfterDocumentWritesOnce = 50;

    await expect(
      processStressPage({
        store,
        payload: buildStressPagePayload(0),
        now: '2026-08-29T00:00:00.000Z',
      }),
    ).rejects.toThrow('synthetic partial page failure');

    expect(store.documents.size).toBe(50);
    expect(store.runs.get(run.id)?.cursor).toBe(0);

    await processStressPage({
      store,
      payload: buildStressPagePayload(0),
      now: '2026-08-29T00:01:00.000Z',
    });

    expect(store.documents.size).toBe(STRESS_PAGE_SIZE);
    expect(store.runs.get(run.id)).toMatchObject({
      cursor: STRESS_PAGE_SIZE,
      processedCount: STRESS_PAGE_SIZE,
    });
  });

  it('rejects an out-of-order cursor instead of silently skipping data', async () => {
    const store = new MemoryCoreStore();
    await seedStressRun(store);

    await expect(
      processStressPage({
        store,
        payload: buildStressPagePayload(100),
        now: '2026-08-29T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(IngestionInvariantError);
  });
});
