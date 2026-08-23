import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

import { runMockIngestion } from '../phase0b/mock-ingestion';
import { PHASE0B_MOCK_INGESTION_QUEUE } from './boss';
import { parseMhooJobEnvelope, type TenantJobHandler } from './context';
import { parseMockIngestionPayload, type MockIngestionPayload } from './enqueue';

function mockIngestionHandler(
  workerDataPool: Pool,
  failedOnce: Set<string>,
): TenantJobHandler<MockIngestionPayload, void> {
  return async (context, payload) => {
    await runMockIngestion(workerDataPool, context, payload, { failedOnce });
  };
}

/** Registers one domain-specific queue handler; no workflow abstraction exists. */
export async function registerMockIngestionWorker(boss: PgBoss, workerDataPool: Pool): Promise<string> {
  const failedOnce = new Set<string>();
  const handler = mockIngestionHandler(workerDataPool, failedOnce);

  return boss.work<Record<string, unknown>>(
    PHASE0B_MOCK_INGESTION_QUEUE,
    { pollingIntervalSeconds: 0.5, localConcurrency: 1 },
    async ([job]) => {
      const envelope = parseMhooJobEnvelope(job.data, parseMockIngestionPayload);
      await handler(envelope.context, envelope.payload);
    },
  );
}
