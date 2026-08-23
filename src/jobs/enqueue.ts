import type { PgBoss } from 'pg-boss';
import type { PoolClient } from 'pg';

import { tenantId } from '../db/tenant-context';
import { PHASE0B_MOCK_INGESTION_QUEUE } from './boss';
import {
  createMhooJobEnvelope,
  type MhooJobContext,
  type TenantFreePayload,
} from './context';
import { pgBossDatabase } from './pg-boss-db';

export type MockIngestionPayload = TenantFreePayload & {
  ingestionId: string;
  documentId: string;
  sourceRevision: string;
  transformVersion: string;
  failOnceAt?: number;
  permanentlyFailAt?: number;
  holdTransactionAt?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Mock ingestion payload must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Mock ingestion payload ${field} must be a non-empty string`);
  return value;
}

function optionalOrdinal(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new Error(`Mock ingestion payload ${field} must be an integer from 1 to 100`);
  }
  return value as number;
}

/**
 * Re-validates persisted job JSON and explicitly rejects tenancy in the domain
 * payload. Tenant context belongs exclusively in MhooJobEnvelope.context.
 */
export function parseMockIngestionPayload(value: unknown): MockIngestionPayload {
  const raw = asRecord(value);
  if ('tenantId' in raw) throw new Error('Mock ingestion payload must not contain tenantId');
  tenantId(requiredString(raw.ingestionId, 'ingestionId'));
  return {
    ingestionId: requiredString(raw.ingestionId, 'ingestionId'),
    documentId: requiredString(raw.documentId, 'documentId'),
    sourceRevision: requiredString(raw.sourceRevision, 'sourceRevision'),
    transformVersion: requiredString(raw.transformVersion, 'transformVersion'),
    failOnceAt: optionalOrdinal(raw.failOnceAt, 'failOnceAt'),
    permanentlyFailAt: optionalOrdinal(raw.permanentlyFailAt, 'permanentlyFailAt'),
    holdTransactionAt: optionalOrdinal(raw.holdTransactionAt, 'holdTransactionAt'),
  };
}

/**
 * Adds a job using the caller's current database transaction. This adapter is
 * intentionally a single `PoolClient`, not the API pool: rollback removes both
 * the Drizzle domain write and the queued job.
 */
export async function enqueueMockIngestion(
  boss: PgBoss,
  transaction: PoolClient,
  context: MhooJobContext,
  payload: MockIngestionPayload,
): Promise<string> {
  const id = await boss.send(PHASE0B_MOCK_INGESTION_QUEUE, createMhooJobEnvelope(context, payload), {
    db: pgBossDatabase(transaction),
    singletonKey: payload.ingestionId,
    expireInSeconds: Number(process.env.PHASE0B_JOB_EXPIRE_SECONDS ?? '2'),
    retryLimit: Number(process.env.PHASE0B_JOB_RETRY_LIMIT ?? '2'),
    retryDelay: Number(process.env.PHASE0B_JOB_RETRY_DELAY_SECONDS ?? '0'),
  });

  if (!id) throw new Error('pg-boss did not accept the mock ingestion job');
  return id;
}
