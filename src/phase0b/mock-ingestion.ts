import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';

import { withTenantDrizzleTransaction } from '../db/drizzle-transaction';
import type { TenantId } from '../db/tenant-context';
import type { MhooJobContext } from '../jobs/context';
import type { MockIngestionPayload } from '../jobs/enqueue';

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

export function mockItem(context: MhooJobContext, payload: Pick<MockIngestionPayload, 'documentId' | 'sourceRevision' | 'transformVersion'>, ordinal: number): MockItem {
  const normalizedContent = `phase0b mock document ${payload.documentId} revision ${payload.sourceRevision} item ${ordinal}`;
  return {
    ordinal,
    normalizedContent,
    contentHash: hash(normalizedContent),
    chunkKey: canonicalChunkKey({ tenantId: context.tenantId, ...payload, chunkOrdinal: ordinal }),
  };
}

/**
 * Deterministic, provider-free work deliberately bounded to 100 independent
 * item transactions. No GitHub, embeddings, object store, MCP, or transform
 * framework participates in this selection proof.
 */
export async function runMockIngestion(
  workerDataPool: Pool,
  context: MhooJobContext,
  payload: MockIngestionPayload,
  hooks: MockIngestionHooks = {},
): Promise<MockIngestionResult> {
  let created = 0;
  let reconciled = 0;
  const failedOnce = hooks.failedOnce ?? new Set<string>();

  await withTenantDrizzleTransaction(workerDataPool, context.tenantId, async ({ db }) => {
    const processing = await db.execute(sql`
      update core.phase0b_ingestions
      set ingestion_status = 'processing', updated_at = now()
      where id = ${payload.ingestionId}::uuid
      returning id
    `);
    if (processing.rows.length !== 1) {
      throw new Error('Mock ingestion is not visible within trusted tenant context');
    }
  });

  for (let ordinal = 1; ordinal <= MOCK_ITEM_COUNT; ordinal += 1) {
    const item = mockItem(context, payload, ordinal);

    await withTenantDrizzleTransaction(workerDataPool, context.tenantId, async ({ db }) => {
      const inserted = await db.execute(sql`
        insert into core.phase0b_items (
          chunk_key, tenant_id, ingestion_id, document_id, source_revision,
          transform_version, chunk_ordinal, content_hash, normalized_content
        ) values (
          ${item.chunkKey}, ${context.tenantId}::uuid, ${payload.ingestionId}::uuid,
          ${payload.documentId}, ${payload.sourceRevision}, ${payload.transformVersion},
          ${item.ordinal}, ${item.contentHash}, ${item.normalizedContent}
        )
        on conflict (chunk_key) do nothing
        returning chunk_key
      `);

      if (inserted.rows.length === 1) created += 1;
      else reconciled += 1;

      await hooks.onItemInsideTransaction?.(item);

      if (payload.holdTransactionAt === ordinal && process.env.PHASE0B_HOLD_TRANSACTIONS === '1') {
        // Used only by the SIGKILL proof; its parent terminates this process.
        console.log(`PHASE0B_HOLDING_TRANSACTION ${ordinal}`);
        await delay(30_000);
      }

      if (payload.permanentlyFailAt === ordinal) {
        throw new Error(`deterministic permanent mock failure at item ${ordinal}`);
      }

      const failureKey = `${payload.ingestionId}:${ordinal}`;
      if (payload.failOnceAt === ordinal && !failedOnce.has(failureKey)) {
        failedOnce.add(failureKey);
        throw new Error(`deterministic one-time mock failure at item ${ordinal}`);
      }
    });
  }

  await withTenantDrizzleTransaction(workerDataPool, context.tenantId, async ({ db }) => {
    await db.execute(sql`
      update core.phase0b_ingestions
      set ingestion_status = 'completed', last_ingested_at = now(), updated_at = now()
      where id = ${payload.ingestionId}::uuid
    `);
  });

  return { created, reconciled };
}
