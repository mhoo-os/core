import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

import { runMockIngestion } from '../phase0b/mock-ingestion';
import { PHASE0B_MOCK_INGESTION_QUEUE } from './boss';
import type { MockIngestionJob } from './enqueue';

/** Registers one domain-specific queue handler; no workflow abstraction exists. */
export async function registerMockIngestionWorker(boss: PgBoss, workerDataPool: Pool): Promise<string> {
  const failedOnce = new Set<string>();

  return boss.work<MockIngestionJob>(
    PHASE0B_MOCK_INGESTION_QUEUE,
    { pollingIntervalSeconds: 0.5, localConcurrency: 1 },
    async ([job]) => runMockIngestion(workerDataPool, job.data, { failedOnce }),
  );
}
