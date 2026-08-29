import {
  type DocumentRecord,
  type KnowledgeSourceRecord,
  type SyncRunRecord,
} from 'src/domain/contracts';
import { deterministicUuid, sha256 } from 'src/domain/deterministic-id';

export const SINGLE_FIXTURE_ID = 'mhoo-core-bounded-v1';
export const STRESS_FIXTURE_ID = 'mhoo-core-stress-1000-v1';
export const FIXTURE_REVISION = 'synthetic-revision-1';
export const STRESS_RECORD_COUNT = 1_000;
export const STRESS_PAGE_SIZE = 100;
export const STRESS_FAILURE_CURSOR = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isExactFixtureRequest = (body: unknown, fixtureId: string): boolean =>
  isRecord(body) &&
  Object.keys(body).length === 1 &&
  body.fixtureId === fixtureId;

export const validateSingleFixtureRequest = (body: unknown): void => {
  if (!isExactFixtureRequest(body, SINGLE_FIXTURE_ID)) {
    throw new Error(
      `Only the synthetic fixture ${SINGLE_FIXTURE_ID} is accepted`,
    );
  }
};

export const validateStressFixtureRequest = (body: unknown): void => {
  if (!isExactFixtureRequest(body, STRESS_FIXTURE_ID)) {
    throw new Error(
      `Only the synthetic fixture ${STRESS_FIXTURE_ID} is accepted`,
    );
  }
};

export type PageJobPayload = {
  fixtureId: typeof STRESS_FIXTURE_ID;
  sourceId: string;
  runId: string;
  cursor: number;
  pageSize: number;
  total: number;
};

export const validatePageJobPayload = (value: unknown): PageJobPayload => {
  if (!isRecord(value)) {
    throw new Error('Page job payload must be an object');
  }

  const candidate = value as Partial<PageJobPayload>;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'cursor',
    'fixtureId',
    'pageSize',
    'runId',
    'sourceId',
    'total',
  ];

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    candidate.fixtureId !== STRESS_FIXTURE_ID ||
    typeof candidate.sourceId !== 'string' ||
    !UUID_PATTERN.test(candidate.sourceId) ||
    typeof candidate.runId !== 'string' ||
    !UUID_PATTERN.test(candidate.runId) ||
    !Number.isInteger(candidate.cursor) ||
    (candidate.cursor ?? -1) < 0 ||
    !Number.isInteger(candidate.pageSize) ||
    candidate.pageSize !== STRESS_PAGE_SIZE ||
    candidate.total !== STRESS_RECORD_COUNT
  ) {
    throw new Error('Page job payload does not match the bounded fixture');
  }

  return candidate as PageJobPayload;
};

const buildSource = ({
  sourceKey,
  displayName,
}: {
  sourceKey: string;
  displayName: string;
}): KnowledgeSourceRecord => {
  const sourceUri = `mhoo-synthetic://${sourceKey}`;

  return {
    id: deterministicUuid('knowledge-source', sourceKey),
    sourceKey,
    displayName,
    provider: 'synthetic-local',
    sourceUri,
    revision: FIXTURE_REVISION,
    provenanceHash: sha256(
      `${sourceKey}|${sourceUri}|${FIXTURE_REVISION}|synthetic-local`,
    ),
  };
};

export const buildSingleSource = (): KnowledgeSourceRecord =>
  buildSource({
    sourceKey: 'synthetic/local/bounded',
    displayName: 'Bounded synthetic source',
  });

export const buildStressSource = (): KnowledgeSourceRecord =>
  buildSource({
    sourceKey: 'synthetic/local/stress-1000',
    displayName: 'Synthetic 1,000-record source',
  });

export const buildSyncRun = ({
  fixtureId,
  sourceId,
  expectedCount,
  triggerKind,
  startedAt,
}: {
  fixtureId: string;
  sourceId: string;
  expectedCount: number;
  triggerKind: string;
  startedAt: string;
}): SyncRunRecord => ({
  id: deterministicUuid('sync-run', fixtureId),
  sourceId,
  runKey: fixtureId,
  status: 'RUNNING',
  cursor: 0,
  expectedCount,
  processedCount: 0,
  fixtureRevision: FIXTURE_REVISION,
  triggerKind,
  startedAt,
  completedAt: null,
  failureReason: null,
});

export const buildSyntheticDocument = ({
  source,
  runId,
  index,
}: {
  source: KnowledgeSourceRecord;
  runId: string;
  index: number;
}): DocumentRecord => {
  const logicalKey = `${source.sourceKey}/item/${index.toString().padStart(4, '0')}`;
  const content = `Synthetic Mhoo Core feasibility document ${index}. Stable content for retry and idempotency proof.`;
  const sourceUri = `${source.sourceUri}/items/${index}`;
  const rawArtifactHash = sha256(content);

  return {
    id: deterministicUuid('document', logicalKey),
    sourceId: source.id,
    syncRunId: runId,
    logicalKey,
    title: `Synthetic document ${index}`,
    content,
    sourceUri,
    revision: FIXTURE_REVISION,
    provenanceHash: sha256(
      `${logicalKey}|${sourceUri}|${FIXTURE_REVISION}|${rawArtifactHash}`,
    ),
    rawArtifactKey: `proof/raw/${rawArtifactHash}.txt`,
    rawArtifactHash,
    contentType: 'text/plain',
    byteLength: Buffer.byteLength(content, 'utf8'),
    metadata: {
      fixtureId:
        source.sourceKey === 'synthetic/local/bounded'
          ? SINGLE_FIXTURE_ID
          : STRESS_FIXTURE_ID,
      index,
      synthetic: true,
      schemaVersion: 1,
    },
  };
};

export const buildStressPagePayload = (cursor: number): PageJobPayload => {
  const source = buildStressSource();
  const run = buildSyncRun({
    fixtureId: STRESS_FIXTURE_ID,
    sourceId: source.id,
    expectedCount: STRESS_RECORD_COUNT,
    triggerKind: 'HTTP_BACKGROUND',
    startedAt: '1970-01-01T00:00:00.000Z',
  });

  return {
    fixtureId: STRESS_FIXTURE_ID,
    sourceId: source.id,
    runId: run.id,
    cursor,
    pageSize: STRESS_PAGE_SIZE,
    total: STRESS_RECORD_COUNT,
  };
};
