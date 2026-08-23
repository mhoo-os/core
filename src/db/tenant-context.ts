import type { Pool, PoolClient } from 'pg';

export type TenantId = string & { readonly __tenantId: unique symbol };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function tenantId(value: string): TenantId {
  if (!UUID_PATTERN.test(value)) {
    throw new Error('tenant_id must be a UUID');
  }

  return value as TenantId;
}

export type TenantTransaction = PoolClient;

export async function withTenantTransaction<TResult>(
  pool: Pool,
  currentTenantId: TenantId,
  operation: (transaction: TenantTransaction) => Promise<TResult>,
): Promise<TResult> {
  const transaction = await pool.connect();

  try {
    await transaction.query('begin');
    await transaction.query("select set_config('app.current_tenant_id', $1, true)", [currentTenantId]);
    const result = await operation(transaction);
    await transaction.query('commit');
    return result;
  } catch (error) {
    await transaction.query('rollback');
    throw error;
  } finally {
    transaction.release();
  }
}
