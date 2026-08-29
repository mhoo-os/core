import { describe, expect, it } from 'vitest';

import { type SyncRunRecord } from 'src/domain/contracts';
import { toWritableSyncRunRecord } from 'src/domain/rest-core-store';

describe('REST Core store serialization', () => {
  it('does not send server-managed fields back through an upsert', () => {
    const writable: SyncRunRecord = {
      id: '49bfdfd8-e060-40b1-8d2b-84d56aad4084',
      sourceId: '18a29d04-1630-45e8-8d8f-540809cd70ef',
      runKey: 'mhoo-core-stress-1000-v1',
      status: 'RUNNING',
      cursor: 100,
      expectedCount: 1_000,
      processedCount: 100,
      fixtureRevision: 'v1',
      triggerKind: 'HTTP_BACKGROUND',
      startedAt: '2026-08-29T00:00:00.000Z',
      completedAt: null,
      failureReason: null,
    };
    const restRead = {
      ...writable,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:01:00.000Z',
      createdBy: { source: 'API' },
      source: { id: writable.sourceId },
    } as SyncRunRecord;

    expect(toWritableSyncRunRecord(restRead)).toEqual(writable);
  });
});
