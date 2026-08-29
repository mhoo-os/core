import {
  type CoreStore,
  type DocumentRecord,
  type KnowledgeSourceRecord,
  type SyncRunRecord,
} from 'src/domain/contracts';
import { IngestionInvariantError } from 'src/domain/ingestion';

export class MemoryCoreStore implements CoreStore {
  readonly sources = new Map<string, KnowledgeSourceRecord>();
  readonly runs = new Map<string, SyncRunRecord>();
  readonly documents = new Map<string, DocumentRecord>();

  failAfterDocumentWritesOnce: number | null = null;

  async getSyncRun(id: string): Promise<SyncRunRecord | null> {
    return this.runs.get(id) ?? null;
  }

  async listSyncRuns(): Promise<SyncRunRecord[]> {
    return [...this.runs.values()];
  }

  async upsertKnowledgeSource(
    record: KnowledgeSourceRecord,
  ): Promise<KnowledgeSourceRecord> {
    const existing = this.sources.get(record.id);

    if (existing && existing.sourceKey !== record.sourceKey) {
      throw new IngestionInvariantError('Source idempotency conflict');
    }

    this.sources.set(record.id, structuredClone(record));

    return structuredClone(record);
  }

  async upsertSyncRun(record: SyncRunRecord): Promise<SyncRunRecord> {
    const existing = this.runs.get(record.id);

    if (existing && existing.runKey !== record.runKey) {
      throw new IngestionInvariantError('Run idempotency conflict');
    }

    this.runs.set(record.id, structuredClone(record));

    return structuredClone(record);
  }

  async upsertDocuments(records: DocumentRecord[]): Promise<number> {
    let writes = 0;

    for (const record of records) {
      const existing = this.documents.get(record.id);

      if (
        existing &&
        (existing.logicalKey !== record.logicalKey ||
          existing.provenanceHash !== record.provenanceHash)
      ) {
        throw new IngestionInvariantError('Document idempotency conflict');
      }

      this.documents.set(record.id, structuredClone(record));
      writes += 1;

      if (
        this.failAfterDocumentWritesOnce !== null &&
        writes === this.failAfterDocumentWritesOnce
      ) {
        this.failAfterDocumentWritesOnce = null;
        throw new Error('synthetic partial page failure');
      }
    }

    return records.length;
  }
}
