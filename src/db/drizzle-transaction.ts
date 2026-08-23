import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient } from 'pg';

import { type TenantId } from './tenant-context';

export type DrizzleTenantTransaction = {
  client: PoolClient;
  db: NodePgDatabase;
};

/**
 * Opens a short-lived, tenant-scoped transaction for domain work. The `pg`
 * client and Drizzle handle deliberately share one transaction so a caller can
 * compose Drizzle domain writes with pg-boss's transaction-aware send.
 */
export async function withTenantDrizzleTransaction<TResult>(
  pool: Pool,
  currentTenantId: TenantId,
  operation: (transaction: DrizzleTenantTransaction) => Promise<TResult>,
): Promise<TResult> {
  const client = await pool.connect();

  try {
    await client.query('begin');
    await client.query("select set_config('app.current_tenant_id', $1, true)", [currentTenantId]);
    const result = await operation({ client, db: drizzle(client) });
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
