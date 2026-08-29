export type SyncRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export type KnowledgeSourceRecord = {
  id: string;
  sourceKey: string;
  displayName: string;
  provider: string;
  sourceUri: string;
  revision: string;
  provenanceHash: string;
};

export type SyncRunRecord = {
  id: string;
  sourceId: string;
  runKey: string;
  status: SyncRunStatus;
  cursor: number;
  expectedCount: number;
  processedCount: number;
  fixtureRevision: string;
  triggerKind: string;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
};

export type DocumentRecord = {
  id: string;
  sourceId: string;
  syncRunId: string;
  logicalKey: string;
  title: string;
  content: string;
  sourceUri: string;
  revision: string;
  provenanceHash: string;
  rawArtifactKey: string | null;
  rawArtifactHash: string | null;
  contentType: string;
  byteLength: number;
  metadata: Record<string, unknown>;
};

export interface CoreStore {
  getSyncRun(id: string): Promise<SyncRunRecord | null>;
  listSyncRuns(): Promise<SyncRunRecord[]>;
  upsertKnowledgeSource(
    record: KnowledgeSourceRecord,
  ): Promise<KnowledgeSourceRecord>;
  upsertSyncRun(record: SyncRunRecord): Promise<SyncRunRecord>;
  upsertDocuments(records: DocumentRecord[]): Promise<number>;
}
