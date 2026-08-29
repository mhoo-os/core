import {
  RestApiClient,
  RestApiClientError,
} from 'twenty-client-sdk/rest';

import {
  type CoreStore,
  type DocumentRecord,
  type KnowledgeSourceRecord,
  type SyncRunRecord,
} from 'src/domain/contracts';
import { IngestionInvariantError } from 'src/domain/ingestion';

type RestEnvelope = { data?: Record<string, unknown> };

export const toWritableSyncRunRecord = (
  record: SyncRunRecord,
): SyncRunRecord => ({
  id: record.id,
  sourceId: record.sourceId,
  runKey: record.runKey,
  status: record.status,
  cursor: record.cursor,
  expectedCount: record.expectedCount,
  processedCount: record.processedCount,
  fixtureRevision: record.fixtureRevision,
  triggerKind: record.triggerKind,
  startedAt: record.startedAt,
  completedAt: record.completedAt,
  failureReason: record.failureReason,
});

const unwrapRecord = <T>(response: unknown, key: string): T => {
  const record = (response as RestEnvelope | null)?.data?.[key];

  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new IngestionInvariantError(`REST response is missing data.${key}`);
  }

  return record as T;
};

const unwrapRecords = <T>(response: unknown, key: string): T[] => {
  const records = (response as RestEnvelope | null)?.data?.[key];

  if (!Array.isArray(records)) {
    throw new IngestionInvariantError(`REST response is missing data.${key}`);
  }

  return records as T[];
};

export class RestCoreStore implements CoreStore {
  private readonly client = new RestApiClient({ runAs: 'application' });

  async getSyncRun(id: string): Promise<SyncRunRecord | null> {
    try {
      const response = await this.client.get(`/rest/syncRuns/${id}`);

      return unwrapRecord<SyncRunRecord>(response, 'syncRun');
    } catch (error) {
      if (error instanceof RestApiClientError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async listSyncRuns(): Promise<SyncRunRecord[]> {
    const response = await this.client.get('/rest/syncRuns', {
      query: { limit: 200 },
    });

    return unwrapRecords<SyncRunRecord>(response, 'syncRuns');
  }

  async upsertKnowledgeSource(
    record: KnowledgeSourceRecord,
  ): Promise<KnowledgeSourceRecord> {
    const response = await this.client.post('/rest/knowledgeSources', record, {
      query: { upsert: true },
    });

    return unwrapRecord<KnowledgeSourceRecord>(
      response,
      'createKnowledgeSource',
    );
  }

  async upsertSyncRun(record: SyncRunRecord): Promise<SyncRunRecord> {
    const response = await this.client.post(
      '/rest/syncRuns',
      toWritableSyncRunRecord(record),
      {
        query: { upsert: true },
      },
    );

    return unwrapRecord<SyncRunRecord>(response, 'createSyncRun');
  }

  async upsertDocuments(records: DocumentRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const response = await this.client.post('/rest/batch/documents', records, {
      query: { upsert: true },
    });

    return unwrapRecords<DocumentRecord>(response, 'createDocuments').length;
  }
}
