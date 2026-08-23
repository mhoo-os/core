import { NextResponse } from 'next/server';
import { getCoreRuntimePool } from '../../../../src/db/runtime-pool';
import { listEvidenceForWorkspace, listEvidenceWithoutTenantContext } from '../../../../src/db/core-data';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const proofKey = process.env.PHASE0_PROOF_KEY;

  if (!proofKey || request.headers.get('x-mhoo-phase0-proof-key') !== proofKey) {
    return new NextResponse(null, { status: 404 });
  }

  const body = (await request.json()) as { mode?: unknown; twentyWorkspaceId?: unknown };
  const pool = getCoreRuntimePool();

  if (body.mode === 'contextless') {
    return NextResponse.json({ objectKeys: await listEvidenceWithoutTenantContext(pool) });
  }

  if (typeof body.twentyWorkspaceId !== 'string') {
    return NextResponse.json({ error: 'twentyWorkspaceId is required' }, { status: 400 });
  }

  const objectKeys = await listEvidenceForWorkspace(pool, body.twentyWorkspaceId);

  return NextResponse.json({ objectKeys });
}
