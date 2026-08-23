import type { Pool } from 'pg';

import { tenantId, type TenantId, withTenantTransaction } from './tenant-context';

export type WorkspaceBinding = {
  tenantId: TenantId;
  twentyWorkspaceId: string;
};

export async function resolveTrustedWorkspaceBinding(
  pool: Pool,
  twentyWorkspaceId: string,
): Promise<WorkspaceBinding> {
  const result = await pool.query(
    `select tenant_id, twenty_workspace_id
     from core.workspace_bindings
     where twenty_workspace_id = $1`,
    [twentyWorkspaceId],
  );
  const binding = result.rows[0] as
    | { tenant_id: string; twenty_workspace_id: string }
    | undefined;

  if (!binding) {
    throw new Error('No trusted Core binding exists for this Twenty Workspace');
  }

  return {
    tenantId: tenantId(binding.tenant_id),
    twentyWorkspaceId: binding.twenty_workspace_id,
  };
}

export async function listEvidenceForWorkspace(
  pool: Pool,
  twentyWorkspaceId: string,
): Promise<string[]> {
  const binding = await resolveTrustedWorkspaceBinding(pool, twentyWorkspaceId);

  return withTenantTransaction(pool, binding.tenantId, async (transaction) => {
    const result = await transaction.query(`select object_key from core.evidence_objects order by object_key`);

    return result.rows.map((row) => String((row as { object_key: string }).object_key));
  });
}

export async function listEvidenceWithoutTenantContext(pool: Pool): Promise<string[]> {
  const result = await pool.query(`select object_key from core.evidence_objects order by object_key`);

  return result.rows.map((row) => String((row as { object_key: string }).object_key));
}
