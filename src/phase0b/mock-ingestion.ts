import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';

import { withTenantDrizzleTransaction } from '../db/drizzle-transaction';
import { tenantId, type TenantId } from '../db/tenant-context';
import type { MockIngestionJob } from '../jobs/enqueue';

export const MOCK_ITEM_COUNT = 100;

export type MockItem = {
  ordinal: number;
  normalizedContent: string;
  contentHash: string;
  chunkKey: string;
};

export type MockIngestionHooks = {
  onItemInsideTransaction?: (item: MockItem) => Promise<void>;
  failedOnce?: Set<string>;
};

export type MockIngestionResult = {
  created: number;
  reconciled: number;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalChunkKey(input: {
  tenantId: TenantId;
  documentId: string;
  sourceRevision: string;
  transformVersion: string;
  chunkOrdinal: number;
}): string {
  return hash([
    input.tenantId,
    input.documentId,
    input.sourceRevision,
    input.transformVersion,
    input.chunkOrdinal,
  ].join('\n'));
}

export function mockItem(job: Pick<MockIngestionJob, 'tenantId' | 'documentId' | 'sourceRevision' | 'transformVersion'>, ordinal: number): MockItem {
  const normalizedContent = `phase0b mock document ${job.documentId} revision ${job.sourceRevision} item ${ordinal}`;
  return {
    ordinal,
    normalizedContent,
    contentHash: hash(normalizedContent),
    chunkKey: canonicalChunkKey({ ...job, chunkOrdinal: ordinal }),
  };
}

/**
 * Deterministic, provider-free work deliberately bounded to 100 independent
 * item transactions. No GitHub, embeddings, object store, MCP, or transform
 * framework participates in this selection proof.
 */
export async function runMockIngestion(
  workerDataPool: Pool,
  job: MockIngestionJob,
  hooks: MockIngestionHooks = {},
): Promise<MockIngestionResult> {
  let created = 0;
  let reconciled = 0;
  const failedOnce = hooks.failedOnce ?? new Set<string>();

  await withTenantDrizzleTransaction(workerDataPool, tenantId(job.tenantId), async ({ db }) => {
    await db.execute(sql`
      update core.phase0b_ingestions
      set ingestion_status = 'processing', updated_at = now()
      where id = ${job.ingestionId}::uuid
    `);
  });

  for (let ordinal = 1; ordinal <= MOCK_ITEM_COUNT; ordinal += 1) {
    const item = mockItem(job, ordinal);

    await withTenantDrizzleTransaction(workerDataPool, tenantId(job.tenantId), async ({ db }) => {
      const inserted = await db.execute(sql`
        insert into core.phase0b_items (
          chunk_key, tenant_id, ingestion_id, document_id, source_revision,
          transform_version, chunk_ordinal, content_hash, normalized_content
        ) values (
          ${item.chunkKey}, ${job.tenantId}::uuid, ${job.ingestionId}::uuid,
          ${job.documentId}, ${job.sourceRevision}, ${job.transformVersion},
          ${item.ordinal}, ${item.contentHash}, ${item.normalizedContent}
        )
        on conflict (chunk_key) do nothing
        returning chunk_key
      `);

      if (inserted.rows.length === 1) created += 1;
      else reconciled += 1;

      await hooks.onItemInsideTransaction?.(item);

      if (job.holdTransactionAt === ordinal && process.env.PHASE0B_HOLD_TRANSACTIONS === '1') {
        // Used only by the SIGKILL proof; its parent terminates this process.
        console.log(`PHASE0B_HOLDING_TRANSACTION ${ordinal}`);
        await delay(30_000);
      }

      if (job.permanentlyFailAt === ordinal) {
        throw new Error(`deterministic permanent mock failure at item ${ordinal}`);
      }

      const failureKey = `${job.ingestionId}:${ordinal}`;
      if (job.failOnceAt === ordinal && !failedOnce.has(failureKey)) {
        failedOnce.add(failureKey);
        throw new Error(`deterministic one-time mock failure at item ${ordinal}`);
      }
    });
  }

  await withTenantDrizzleTransaction(workerDataPool, tenantId(job.tenantId), async ({ db }) => {
    await db.execute(sql`
      update core.phase0b_ingestions
      set ingestion_status = 'completed', last_ingested_at = now(), updated_at = now()
      where id = ${job.ingestionId}::uuid
    `);
  });

  return { created, reconciled };
}
