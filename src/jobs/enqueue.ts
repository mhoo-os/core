import type { PgBoss } from 'pg-boss';
import type { PoolClient } from 'pg';

import type { TenantId } from '../db/tenant-context';
import { PHASE0B_MOCK_INGESTION_QUEUE } from './boss';
import { pgBossDatabase } from './pg-boss-db';

export type MockIngestionJob = {
  ingestionId: string;
  tenantId: TenantId;
  documentId: string;
  sourceRevision: string;
  transformVersion: string;
  failOnceAt?: number;
  permanentlyFailAt?: number;
  holdTransactionAt?: number;
};

/**
 * Adds a job using the caller's current database transaction. This adapter is
 * intentionally a single `PoolClient`, not the API pool: rollback removes both
 * the Drizzle domain write and the queued job.
 */
export async function enqueueMockIngestion(
  boss: PgBoss,
  transaction: PoolClient,
  job: MockIngestionJob,
): Promise<string> {
  const id = await boss.send(PHASE0B_MOCK_INGESTION_QUEUE, job, {
    db: pgBossDatabase(transaction),
    singletonKey: job.ingestionId,
    expireInSeconds: Number(process.env.PHASE0B_JOB_EXPIRE_SECONDS ?? '2'),
    retryLimit: Number(process.env.PHASE0B_JOB_RETRY_LIMIT ?? '2'),
    retryDelay: Number(process.env.PHASE0B_JOB_RETRY_DELAY_SECONDS ?? '0'),
  });

  if (!id) throw new Error('pg-boss did not accept the mock ingestion job');
  return id;
}
