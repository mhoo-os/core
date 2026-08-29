import {
  type CoreStore,
  type SyncRunRecord,
} from 'src/domain/contracts';
import {
  buildSingleSource,
  buildStressSource,
  buildSyntheticDocument,
  buildSyncRun,
  FIXTURE_REVISION,
  SINGLE_FIXTURE_ID,
  type PageJobPayload,
} from 'src/domain/synthetic-fixture';

export class IngestionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionInvariantError';
  }
}

export const ingestSingleFixture = async ({
  store,
  now,
}: {
  store: CoreStore;
  now: string;
}): Promise<{ sourceId: string; runId: string; documentId: string }> => {
  const source = buildSingleSource();
  const run = buildSyncRun({
    fixtureId: SINGLE_FIXTURE_ID,
    sourceId: source.id,
    expectedCount: 1,
    triggerKind: 'HTTP',
    startedAt: now,
  });
  const document = buildSyntheticDocument({
    source,
    runId: run.id,
    index: 0,
  });

  await store.upsertKnowledgeSource(source);
  await store.upsertSyncRun(run);

  try {
    const persistedCount = await store.upsertDocuments([document]);

    if (persistedCount !== 1) {
      throw new IngestionInvariantError(
        `Expected one document response, received ${persistedCount}`,
      );
    }

    await store.upsertSyncRun({
      ...run,
      status: 'COMPLETED',
      cursor: 1,
      processedCount: 1,
      completedAt: now,
    });
  } catch (error) {
    await store
      .upsertSyncRun({
        ...run,
        status: 'FAILED',
        failureReason:
          error instanceof Error ? error.message.slice(0, 240) : 'Unknown error',
      })
      .catch(() => undefined);

    throw error;
  }

  return { sourceId: source.id, runId: run.id, documentId: document.id };
};

export type PageProcessingResult = {
  run: SyncRunRecord;
  pageStart: number;
  pageEnd: number;
  persistedCount: number;
  replayed: boolean;
  completed: boolean;
};

export const processStressPage = async ({
  store,
  payload,
  now,
  afterDocumentsPersisted,
}: {
  store: CoreStore;
  payload: PageJobPayload;
  now: string;
  afterDocumentsPersisted?: () => Promise<void>;
}): Promise<PageProcessingResult> => {
  const run = await store.getSyncRun(payload.runId);

  if (run === null) {
    throw new IngestionInvariantError(`Sync run ${payload.runId} is missing`);
  }

  if (
    run.sourceId !== payload.sourceId ||
    run.expectedCount !== payload.total ||
    run.fixtureRevision !== FIXTURE_REVISION
  ) {
    throw new IngestionInvariantError(
      `Sync run ${payload.runId} does not match its page envelope`,
    );
  }

  if (run.status === 'COMPLETED') {
    return {
      run,
      pageStart: run.cursor,
      pageEnd: run.cursor,
      persistedCount: 0,
      replayed: true,
      completed: true,
    };
  }

  if (run.status !== 'RUNNING') {
    throw new IngestionInvariantError(
      `Sync run ${payload.runId} is not runnable from status ${run.status}`,
    );
  }

  if (run.cursor > payload.cursor) {
    return {
      run,
      pageStart: payload.cursor,
      pageEnd: run.cursor,
      persistedCount: 0,
      replayed: true,
      completed: run.cursor >= payload.total,
    };
  }

  if (run.cursor < payload.cursor) {
    throw new IngestionInvariantError(
      `Page cursor ${payload.cursor} skips stored cursor ${run.cursor}`,
    );
  }

  const source = buildStressSource();

  if (source.id !== payload.sourceId) {
    throw new IngestionInvariantError('Synthetic source identity drifted');
  }

  const pageEnd = Math.min(payload.cursor + payload.pageSize, payload.total);
  const documents = Array.from(
    { length: pageEnd - payload.cursor },
    (_, offset) =>
      buildSyntheticDocument({
        source,
        runId: payload.runId,
        index: payload.cursor + offset,
      }),
  );

  const persistedCount = await store.upsertDocuments(documents);

  if (persistedCount !== documents.length) {
    throw new IngestionInvariantError(
      `Page response count ${persistedCount} does not match ${documents.length}`,
    );
  }

  await afterDocumentsPersisted?.();

  const completed = pageEnd === payload.total;
  const updatedRun = await store.upsertSyncRun({
    ...run,
    cursor: pageEnd,
    processedCount: pageEnd,
    status: completed ? 'COMPLETED' : 'RUNNING',
    completedAt: completed ? now : null,
    failureReason: null,
  });

  return {
    run: updatedRun,
    pageStart: payload.cursor,
    pageEnd,
    persistedCount,
    replayed: false,
    completed,
  };
};
