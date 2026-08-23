import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';

import { Client, Pool } from 'pg';

import { listEvidenceForWorkspace, listEvidenceWithoutTenantContext } from '../src/db/core-data';
import { tenantId, withTenantTransaction } from '../src/db/tenant-context';
import { DeterministicLocalEmbeddingProvider } from '../src/embedding/deterministic-local-embedding-provider';
import { LocalFilesystemEvidenceStore } from '../src/storage/local-filesystem-evidence-store';

const migratorUrl = process.env.PHASE0_MIGRATOR_DATABASE_URL ?? 'postgres://core_migrator:phase0-migrator-local-only@127.0.0.1:55432/mhoo_core_phase0';
const runtimePassword = randomBytes(24).toString('base64url');
const runtimeUrl = `postgres://core_runtime:${runtimePassword}@127.0.0.1:55432/mhoo_core_phase0`;
const proofKey = randomBytes(24).toString('base64url');
const apiPort = 3211;

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const workspaceA = 'twenty-workspace-phase0-a';
const workspaceB = 'twenty-workspace-phase0-b';
const evidenceA = '44444444-4444-4444-8444-444444444444';
const evidenceB = '55555555-5555-4555-8555-555555555555';
const embeddingA = '66666666-6666-4666-8666-666666666666';
const embeddingB = '77777777-7777-4777-8777-777777777777';

function start(command: string, arguments_: string[], environment: NodeJS.ProcessEnv) {
  const child = spawn(command, arguments_, { cwd: process.cwd(), env: environment, stdio: 'pipe' });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitForApi(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${apiPort}/`)).ok) return;
    } catch {
      // Next has not started yet.
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for the Phase 0 HTTP server');
}

async function applyMigrations(): Promise<{ bypassRls: boolean; forceRlsTables: string[]; superuser: boolean }> {
  const client = new Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await client.query('drop schema if exists core cascade');
    await client.query(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'core_runtime') then
          execute 'drop owned by core_runtime';
        end if;
      end
      $$
    `);
    await client.query('drop role if exists core_runtime');
    for (const migrationFile of ['0001_phase0_core.sql', '0002_phase0_runtime_role.sql']) {
      await client.query(await readFile(path.join(process.cwd(), 'db/migrations', migrationFile), 'utf8'));
    }
    await client.query(`alter role core_runtime login password '${runtimePassword.replaceAll("'", "''")}'`);
    await client.query(
      `insert into core.workspace_bindings (tenant_id, twenty_workspace_id) values ($1, $2), ($3, $4)`,
      [tenantA, workspaceA, tenantB, workspaceB],
    );
    await client.query(
      `insert into core.evidence_objects (id, tenant_id, object_key, sha256, byte_size)
       values ($1, $2, 'evidence/${tenantA}/github/a', repeat('a', 64), 1),
              ($3, $4, 'evidence/${tenantB}/github/b', repeat('b', 64), 1)`,
      [evidenceA, tenantA, evidenceB, tenantB],
    );
    const role = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = 'core_runtime'`,
    );
    const rls = await client.query<{ relname: string }>(`
      select relname
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where nspname = 'core' and relname in ('evidence_objects', 'phase0_embeddings')
        and relrowsecurity and relforcerowsecurity
      order by relname
    `);
    return {
      bypassRls: role.rows[0]?.rolbypassrls ?? true,
      forceRlsTables: rls.rows.map((row) => row.relname),
      superuser: role.rows[0]?.rolsuper ?? true,
    };
  } finally {
    await client.end();
  }
}

async function postProbe(body: { mode?: 'contextless'; twentyWorkspaceId?: string }): Promise<string[]> {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/phase0/probe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mhoo-phase0-proof-key': proofKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP tenant probe failed with ${response.status}`);
  return (await response.json() as { objectKeys: string[] }).objectKeys;
}

async function main(): Promise<void> {
  const runtimeRole = await applyMigrations();
  if (runtimeRole.superuser || runtimeRole.bypassRls || runtimeRole.forceRlsTables.length !== 2) throw new Error('Core RLS role or table configuration is unsafe');

  const pool = new Pool({ connectionString: runtimeUrl, max: 1 });
  process.env.DATABASE_URL = runtimeUrl;
  process.env.DATABASE_POOL_MAX = '1';
  process.env.PHASE0_PROOF_KEY = proofKey;

  try {
    const a = await listEvidenceForWorkspace(pool, workspaceA);
    const contextlessAfterA = await listEvidenceWithoutTenantContext(pool);
    const b = await listEvidenceForWorkspace(pool, workspaceB);
    const contextlessAfterB = await listEvidenceWithoutTenantContext(pool);
    if (a.length !== 1 || b.length !== 1 || contextlessAfterA.length !== 0 || contextlessAfterB.length !== 0) throw new Error('RLS pooled-connection proof failed');

    const localDirectory = await mkdtemp(path.join(tmpdir(), 'mhoo-core-phase0-evidence-'));
    const evidenceStore = new LocalFilesystemEvidenceStore(localDirectory);
    const evidenceBody = new TextEncoder().encode('phase0 immutable local evidence');
    const evidenceHash = createHash('sha256').update(evidenceBody).digest('hex');
    const evidenceKey = `evidence/${tenantA}/github/${evidenceHash}`;
    const created = await evidenceStore.put(evidenceKey, { body: evidenceBody, contentType: 'text/plain', sha256: evidenceHash });
    const duplicate = await evidenceStore.put(evidenceKey, { body: evidenceBody, contentType: 'text/plain', sha256: evidenceHash });
    if (!created.created || duplicate.created || !await evidenceStore.exists(evidenceKey)) throw new Error('Local EvidenceStore idempotency proof failed');

    const embeddingProvider = new DeterministicLocalEmbeddingProvider(8);
    const encodedA = `[${(await embeddingProvider.embed('tenant A local vector')).join(',')}]`;
    const encodedB = `[${(await embeddingProvider.embed('tenant B local vector')).join(',')}]`;
    await withTenantTransaction(pool, tenantId(tenantA), (transaction) => transaction.query(
      `insert into core.phase0_embeddings (id, tenant_id, label, embedding) values ($1, $2, 'tenant-a', $3::vector)`,
      [embeddingA, tenantA, encodedA],
    ));
    await withTenantTransaction(pool, tenantId(tenantB), (transaction) => transaction.query(
      `insert into core.phase0_embeddings (id, tenant_id, label, embedding) values ($1, $2, 'tenant-b', $3::vector)`,
      [embeddingB, tenantB, encodedB],
    ));
    const nearest = await withTenantTransaction(pool, tenantId(tenantA), (transaction) => transaction.query<{ label: string }>(
      `select label from core.phase0_embeddings order by embedding <=> $1::vector limit 1`, [encodedA],
    ));
    const nearestLabel = nearest.rows[0]?.label;
    if (nearestLabel !== 'tenant-a') throw new Error('pgvector tenant-safe distance query failed');

    const application = start('pnpm', ['exec', 'next', 'dev', '-p', String(apiPort)], process.env);
    try {
      await waitForApi();
      const httpTenantA = await postProbe({ twentyWorkspaceId: workspaceA });
      const httpContextlessAfterA = await postProbe({ mode: 'contextless' });
      const httpTenantB = await postProbe({ twentyWorkspaceId: workspaceB });
      const httpContextlessAfterB = await postProbe({ mode: 'contextless' });
      if (httpTenantA.length !== 1 || httpTenantB.length !== 1 || httpContextlessAfterA.length !== 0 || httpContextlessAfterB.length !== 0) throw new Error('HTTP tenant proof failed');
      console.log(JSON.stringify({
        http: { tenantA: httpTenantA, contextlessAfterA: httpContextlessAfterA, tenantB: httpTenantB, contextlessAfterB: httpContextlessAfterB },
        localEvidence: { created: created.created, duplicateCreated: duplicate.created, key: evidenceKey },
        pgvector: { nearestLabel, dimensions: embeddingProvider.dimensions },
        rls: { a, b, contextlessAfterA, contextlessAfterB }, runtimeRole,
      }, null, 2));
    } finally {
      application.child.kill('SIGTERM');
    }
  } finally {
    await pool.end();
  }
}

await main();
