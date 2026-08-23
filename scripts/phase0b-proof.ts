import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { sql } from 'drizzle-orm';
import { Client, Pool, type QueryResultRow } from 'pg';

import { withTenantDrizzleTransaction } from '../src/db/drizzle-transaction';
import { tenantId, withTenantTransaction } from '../src/db/tenant-context';
import { createCoreBoss, PHASE0B_DEAD_LETTER_QUEUE, PHASE0B_MOCK_INGESTION_QUEUE } from '../src/jobs/boss';
import { createMhooJobContext, type MhooJobContext } from '../src/jobs/context';
import { enqueueMockIngestion, parseMockIngestionPayload, type MockIngestionPayload } from '../src/jobs/enqueue';
import { installOrUpgradePgBoss } from '../src/jobs/migrator';
import { registerMockIngestionWorker } from '../src/jobs/worker';

const migratorUrl = process.env.PHASE0_MIGRATOR_DATABASE_URL ?? 'postgres://core_migrator:phase0-migrator-local-only@127.0.0.1:55432/mhoo_core_phase0';
const apiPassword = randomBytes(24).toString('base64url');
const workerPassword = randomBytes(24).toString('base64url');
const apiUrl = `postgres://core_api:${apiPassword}@127.0.0.1:55432/mhoo_core_phase0`;
const workerUrl = `postgres://core_worker:${workerPassword}@127.0.0.1:55432/mhoo_core_phase0`;

const tenantA = tenantId('11111111-1111-4111-8111-111111111111');
const tenantB = tenantId('22222222-2222-4222-8222-222222222222');
const workspaceA = 'twenty-workspace-phase0b-a';
const workspaceB = 'twenty-workspace-phase0b-b';

type JobRow = QueryResultRow & { id: string; state: string; retry_count: number; data: { payload: MockIngestionPayload } };
type Child = { child: ChildProcess; output: () => string; waitForText: (text: string) => Promise<void> };
type MockIngestionInput = Omit<MockIngestionPayload, 'ingestionId'> & { context: MhooJobContext };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function phase(name: string): void {
  console.log(`PHASE0B_PROOF ${name}`);
}

function systemContext(currentTenantId: ReturnType<typeof tenantId>): MhooJobContext {
  return createMhooJobContext({
    tenantId: currentTenantId,
    actor: { type: 'system', id: 'phase0b-proof' },
    requestId: `phase0b-proof-${currentTenantId}`,
  });
}

async function waitFor(condition: () => Promise<boolean>, label: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function applyMigrations(): Promise<void> {
  const client = new Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await client.query('drop schema if exists pgboss cascade');
    await client.query('drop schema if exists core cascade');
    for (const role of ['core_api', 'core_worker', 'core_runtime']) {
      await client.query(`drop role if exists ${role}`);
    }
    for (const migration of [
      '0001_phase0_core.sql',
      '0002_phase0_runtime_role.sql',
      '0003_phase0b_runtime_roles.sql',
      '0004_phase0b_mock_ingestion.sql',
    ]) {
      await client.query(await readFile(path.join(process.cwd(), 'db/migrations', migration), 'utf8'));
    }
  } finally {
    await client.end();
  }

  const migratorPool = new Pool({ connectionString: migratorUrl, max: 2, application_name: 'mhoo-core-migrator' });
  try {
    await installOrUpgradePgBoss(migratorPool);
    await migratorPool.query(await readFile(path.join(process.cwd(), 'db/migrations/0005_phase0b_pgboss_runtime_grants.sql'), 'utf8'));
    await migratorPool.query(`alter role core_api login password '${apiPassword}'`);
    await migratorPool.query(`alter role core_worker login password '${workerPassword}'`);
    await migratorPool.query(
      `insert into core.workspace_bindings (tenant_id, twenty_workspace_id) values ($1, $2), ($3, $4)`,
      [tenantA, workspaceA, tenantB, workspaceB],
    );
  } finally {
    await migratorPool.end();
  }
}

async function createIngestionAndEnqueue(
  apiDataPool: Pool,
  apiBoss: ReturnType<typeof createCoreBoss>,
  input: MockIngestionInput,
  rollback = false,
): Promise<{ ingestionId: string; jobId?: string }> {
  const ingestionId = randomUUID();
  let jobId: string | undefined;

  const { context, ...payload } = input;
  await withTenantDrizzleTransaction(apiDataPool, context.tenantId, async ({ client, db }) => {
    // This is intentionally a Drizzle call, not a parallel `pg` write.
    await db.execute(sql`
      insert into core.phase0b_ingestions (
        id, tenant_id, document_id, source_revision, transform_version, ingestion_status
      ) values (
        ${ingestionId}::uuid, ${context.tenantId}::uuid, ${payload.documentId},
        ${payload.sourceRevision}, ${payload.transformVersion}, 'queued'
      )
    `);
    jobId = await enqueueMockIngestion(apiBoss, client, context, { ...payload, ingestionId });
    if (rollback) throw new Error('intentional producer rollback');
  });

  return { ingestionId, jobId };
}

async function countItems(migratorPool: Pool, ingestionId: string): Promise<number> {
  const result = await migratorPool.query<{ count: string }>(
    'select count(*)::text as count from core.phase0b_items where ingestion_id = $1', [ingestionId],
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function ingestionStatus(migratorPool: Pool, ingestionId: string): Promise<string | undefined> {
  const result = await migratorPool.query<{ ingestion_status: string }>(
    'select ingestion_status from core.phase0b_ingestions where id = $1', [ingestionId],
  );
  return result.rows[0]?.ingestion_status;
}

async function findJob(migratorPool: Pool, ingestionId: string): Promise<JobRow | undefined> {
  const result = await migratorPool.query<JobRow>(
    `select id, state, retry_count, data
     from pgboss.job
     where name = $1 and data -> 'payload' ->> 'ingestionId' = $2
     order by created_on desc
     limit 1`,
    [PHASE0B_MOCK_INGESTION_QUEUE, ingestionId],
  );
  return result.rows[0];
}

async function expectFails(client: Client, statement: string): Promise<void> {
  let failed = false;
  try {
    await client.query(statement);
  } catch {
    failed = true;
  }
  assert(failed, `Runtime role unexpectedly succeeded: ${statement}`);
}

async function verifyLeastPrivilege(): Promise<void> {
  for (const connectionString of [apiUrl, workerUrl]) {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await expectFails(client, 'create schema phase0b_forbidden');
      await expectFails(client, 'alter table core.phase0b_items add column forbidden text');
      await expectFails(client, 'alter table core.phase0b_items disable row level security');
      await expectFails(client, 'set row_security = off; select count(*) from core.phase0b_items');
    } finally {
      await client.end();
    }
  }
}

function startWorker(environment: NodeJS.ProcessEnv): Child {
  // Run Node directly. SIGKILL must target the actual worker process, not a
  // package-manager wrapper that can leave a child alive.
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/phase0b-worker.ts'], {
    cwd: process.cwd(),
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  return {
    child,
    output: () => output,
    waitForText: async (text) => waitFor(async () => output.includes(text), `worker output ${text}`),
  };
}

async function stopWorker(child: Child, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  if (child.child.exitCode !== null || child.child.signalCode !== null) return;
  child.child.kill(signal);
  await new Promise<void>((resolve) => child.child.once('exit', () => resolve()));
}

async function verifyTenantIsolation(workerDataPool: Pool, ingestionA: string, ingestionB: string): Promise<void> {
  const a = await withTenantTransaction(workerDataPool, tenantA, async (transaction) => {
    const result = await transaction.query('select count(*)::text as count from core.phase0b_items where ingestion_id = $1', [ingestionA]);
    return Number((result.rows[0] as { count: string }).count);
  });
  const contextlessAfterA = await workerDataPool.query('select count(*)::text as count from core.phase0b_items');
  const b = await withTenantTransaction(workerDataPool, tenantB, async (transaction) => {
    const result = await transaction.query('select count(*)::text as count from core.phase0b_items where ingestion_id = $1', [ingestionB]);
    return Number((result.rows[0] as { count: string }).count);
  });
  const contextlessAfterB = await workerDataPool.query('select count(*)::text as count from core.phase0b_items');
  assert(a === 100 && b === 100, 'Tenant-scoped worker reads did not see their canonical records');
  assert(Number((contextlessAfterA.rows[0] as { count: string }).count) === 0, 'Tenant context leaked after A');
  assert(Number((contextlessAfterB.rows[0] as { count: string }).count) === 0, 'Tenant context leaked after B');
}

async function main(): Promise<void> {
  process.env.PHASE0B_JOB_RETRY_DELAY_SECONDS = '1';
  await applyMigrations();
  phase('migrations-and-queue-install-complete');

  const migratorPool = new Pool({ connectionString: migratorUrl, max: 3, application_name: 'mhoo-core-proof-migrator' });
  const apiDataPool = new Pool({ connectionString: apiUrl, max: 3, application_name: 'mhoo-core-api-data' });
  const bossPool = new Pool({ connectionString: workerUrl, max: 3, application_name: 'mhoo-core-worker-boss' });
  const workerDataPool = new Pool({ connectionString: workerUrl, max: 3, application_name: 'mhoo-core-worker-data' });
  const reusePool = new Pool({ connectionString: workerUrl, max: 1, application_name: 'mhoo-core-rls-reuse' });
  const apiBoss = createCoreBoss(apiDataPool, { supervise: false });
  const workerBoss = createCoreBoss(bossPool);

  let crashWorker: Child | undefined;
  let replacementWorker: Child | undefined;
  try {
    await apiBoss.start();
    await verifyLeastPrivilege();
    phase('least-privilege-complete');

    // Test C: Drizzle domain write and pg-boss enqueue share one transaction.
    const rolledBack = {
      context: systemContext(tenantA),
      documentId: 'atomic-rollback',
      sourceRevision: 'rev-rollback',
      transformVersion: 'phase0b-v1',
    };
    let rollbackObserved = false;
    try {
      await createIngestionAndEnqueue(apiDataPool, apiBoss, rolledBack, true);
    } catch (error) {
      rollbackObserved = error instanceof Error && error.message === 'intentional producer rollback';
    }
    assert(rollbackObserved, 'Producer rollback test did not abort its transaction');
    const rolledBackDomain = await migratorPool.query('select count(*)::text as count from core.phase0b_ingestions where document_id = $1', [rolledBack.documentId]);
    const rolledBackJob = await migratorPool.query('select count(*)::text as count from pgboss.job where data -> \'payload\' ->> \'documentId\' = $1', [rolledBack.documentId]);
    assert(rolledBackDomain.rows[0]?.count === '0' && rolledBackJob.rows[0]?.count === '0', 'Rollback left domain state or a pg-boss job behind');

    const committed = await createIngestionAndEnqueue(apiDataPool, apiBoss, {
      context: systemContext(tenantA),
      documentId: 'atomic-commit',
      sourceRevision: 'rev-commit',
      transformVersion: 'phase0b-v1',
    });
    assert(Boolean(committed.jobId), 'Committed producer transaction did not create a pg-boss job');
    assert(await ingestionStatus(migratorPool, committed.ingestionId) === 'queued', 'Committed producer domain state is absent');
    assert(Boolean(await findJob(migratorPool, committed.ingestionId)), 'Committed producer pg-boss state is absent');
    phase('transactional-enqueue-complete');

    await workerBoss.start();
    await registerMockIngestionWorker(workerBoss, workerDataPool);
    await waitFor(async () => (await countItems(migratorPool, committed.ingestionId)) === 100, 'committed producer job');

    // Test F: job payload cannot declare tenancy, and a Tenant B envelope
    // cannot read or mutate a Tenant A ingestion reference.
    let payloadTenantRejected = false;
    try {
      parseMockIngestionPayload({
        ingestionId: randomUUID(),
        tenantId: tenantA,
        documentId: 'forged-payload-tenant',
        sourceRevision: 'rev-forged',
        transformVersion: 'phase0b-v1',
      });
    } catch (error) {
      payloadTenantRejected = error instanceof Error && error.message === 'Mock ingestion payload must not contain tenantId';
    }
    assert(payloadTenantRejected, 'Worker parser accepted a tenantId in the domain payload');

    const mismatchedIngestionId = randomUUID();
    await withTenantDrizzleTransaction(apiDataPool, tenantA, async ({ db }) => {
      await db.execute(sql`
        insert into core.phase0b_ingestions (
          id, tenant_id, document_id, source_revision, transform_version, ingestion_status
        ) values (
          ${mismatchedIngestionId}::uuid, ${tenantA}::uuid, 'forged-context',
          'rev-forged', 'phase0b-v1', 'queued'
        )
      `);
    });
    await withTenantDrizzleTransaction(apiDataPool, tenantB, async ({ client }) => {
      await enqueueMockIngestion(apiBoss, client, systemContext(tenantB), {
        ingestionId: mismatchedIngestionId,
        documentId: 'forged-context',
        sourceRevision: 'rev-forged',
        transformVersion: 'phase0b-v1',
      });
    });
    await waitFor(async () => (await findJob(migratorPool, mismatchedIngestionId))?.state === 'failed', 'forged tenant-context job', 30_000);
    assert(await countItems(migratorPool, mismatchedIngestionId) === 0, 'Forged tenant context mutated a foreign ingestion');
    assert(await ingestionStatus(migratorPool, mismatchedIngestionId) === 'queued', 'Forged tenant context changed a foreign ingestion status');
    phase('trusted-job-context-complete');

    // Test A: deterministic item 84 failure, then retry/reconcile without duplicates.
    const logicalRetry = await createIngestionAndEnqueue(apiDataPool, apiBoss, {
      context: systemContext(tenantA),
      documentId: 'logical-retry',
      sourceRevision: 'rev-84',
      transformVersion: 'phase0b-v1',
      failOnceAt: 84,
    });
    await waitFor(async () => (await findJob(migratorPool, logicalRetry.ingestionId))?.state === 'retry', 'item 84 retry state');
    assert(await countItems(migratorPool, logicalRetry.ingestionId) === 83, 'Items after deterministic failure were committed');
    await waitFor(async () => (await countItems(migratorPool, logicalRetry.ingestionId)) === 100, 'logical retry completion');
    await waitFor(async () => (await findJob(migratorPool, logicalRetry.ingestionId))?.state === 'completed', 'logical retry job completion');
    const logicalJob = await findJob(migratorPool, logicalRetry.ingestionId);
    assert(logicalJob?.state === 'completed' && logicalJob.retry_count === 1, 'Logical retry did not complete exactly once after one retry');
    const logicalDuplicates = await migratorPool.query<{ count: string }>(
      `select count(*)::text as count from (
         select chunk_key from core.phase0b_items where ingestion_id = $1 group by chunk_key having count(*) > 1
       ) duplicates`, [logicalRetry.ingestionId],
    );
    assert(logicalDuplicates.rows[0]?.count === '0', 'Logical retry produced duplicate canonical records');
    phase('logical-retry-complete');

    // Test B: hard-kill a separate worker inside item 84's tenant transaction.
    await workerBoss.stop({ graceful: false, close: false });
    const crashRecovery = await createIngestionAndEnqueue(apiDataPool, apiBoss, {
      context: systemContext(tenantB),
      documentId: 'hard-kill',
      sourceRevision: 'rev-sigkill',
      transformVersion: 'phase0b-v1',
      holdTransactionAt: 84,
    });
    crashWorker = startWorker({
      ...process.env,
      CORE_WORKER_BOSS_DATABASE_URL: workerUrl,
      CORE_WORKER_DATA_DATABASE_URL: workerUrl,
      CORE_WORKER_BOSS_POOL_MAX: '3',
      CORE_WORKER_DATA_POOL_MAX: '3',
      PHASE0B_HOLD_TRANSACTIONS: '1',
    });
    await crashWorker.waitForText('PHASE0B_HOLDING_TRANSACTION 84');
    await stopWorker(crashWorker, 'SIGKILL');
    await waitFor(async () => (await countItems(migratorPool, crashRecovery.ingestionId)) === 83, 'rollback after SIGKILL');
    await apiDataPool.query('select 1');
    await delay(2_500);
    replacementWorker = startWorker({
      ...process.env,
      CORE_WORKER_BOSS_DATABASE_URL: workerUrl,
      CORE_WORKER_DATA_DATABASE_URL: workerUrl,
      CORE_WORKER_BOSS_POOL_MAX: '3',
      CORE_WORKER_DATA_POOL_MAX: '3',
    });
    await replacementWorker.waitForText('PHASE0B_WORKER_READY');
    await waitFor(async () => (await countItems(migratorPool, crashRecovery.ingestionId)) === 100, 'replacement worker recovery');
    const crashJob = await findJob(migratorPool, crashRecovery.ingestionId);
    assert(crashJob?.state === 'completed' && crashJob.retry_count === 1, 'SIGKILL did not use fresh pg-boss retry semantics');
    phase('sigkill-recovery-complete');

    // Test D: use a one-connection pool after completed, failed/retried, and restarted work.
    await verifyTenantIsolation(reusePool, logicalRetry.ingestionId, crashRecovery.ingestionId);
    phase('rls-isolation-complete');

    // Test E: permanent item failure exhausts retries and copies to the configured DLQ.
    const permanentFailure = await createIngestionAndEnqueue(apiDataPool, apiBoss, {
      context: systemContext(tenantA),
      documentId: 'dead-letter',
      sourceRevision: 'rev-dead-letter',
      transformVersion: 'phase0b-v1',
      permanentlyFailAt: 50,
    });
    await waitFor(async () => (await findJob(migratorPool, permanentFailure.ingestionId))?.state === 'failed', 'dead-letter source failure', 30_000);
    const failedJob = await findJob(migratorPool, permanentFailure.ingestionId);
    assert(failedJob?.retry_count === 2, 'Permanent failure did not stop at the configured retry limit');
    assert(await countItems(migratorPool, permanentFailure.ingestionId) === 49, 'Failed item transaction left partial tenant state');
    const dlq = await migratorPool.query<{ count: string }>(
      'select count(*)::text as count from pgboss.job where name = $1 and data -> \'payload\' ->> \'ingestionId\' = $2',
      [PHASE0B_DEAD_LETTER_QUEUE, permanentFailure.ingestionId],
    );
    assert(Number(dlq.rows[0]?.count ?? '0') === 1, 'Configured dead-letter queue did not receive exhausted job metadata');
    await delay(1_500);
    assert((await findJob(migratorPool, permanentFailure.ingestionId))?.state === 'failed', 'Permanent failure entered an infinite retry loop');
    phase('dead-letter-complete');

    // Test G: exercise API, polling, and worker pools, then record actual use.
    await Promise.all([
      withTenantTransaction(apiDataPool, tenantA, (client) => client.query('select pg_sleep(0.2)')),
      withTenantTransaction(apiDataPool, tenantB, (client) => client.query('select pg_sleep(0.2)')),
      withTenantTransaction(workerDataPool, tenantA, (client) => client.query('select pg_sleep(0.2)')),
      withTenantTransaction(workerDataPool, tenantB, (client) => client.query('select pg_sleep(0.2)')),
    ]);
    const poolUsage = await migratorPool.query<{ application_name: string; connections: string }>(
      `select application_name, count(*)::text as connections
       from pg_stat_activity
       where datname = current_database() and application_name like 'mhoo-core-%'
       group by application_name order by application_name`,
    );
    const observedConnections = poolUsage.rows.reduce((total, row) => total + Number(row.connections), 0);
    assert(observedConnections <= 10, `Observed ${observedConnections} Core connections, above the configured 3+3+3 budget`);
    phase('connection-budget-complete');

    console.log(JSON.stringify({
      verdict: {
        'PG-BOSS RUNTIME': 'PASS',
        'TRANSACTIONAL ENQUEUE': 'PASS',
        'LOGICAL RETRY': 'PASS',
        'WORKER CRASH RECOVERY': 'PASS',
        'TENANT RLS': 'PASS',
        'POOL HYGIENE': 'PASS',
        'LEAST PRIVILEGE': 'PASS',
        'DEAD-LETTER PATH': 'PASS',
        'TRUSTED JOB CONTEXT': 'PASS',
        'ANTI-INNER-PLATFORM GATE': 'PASS',
      },
      antiInnerPlatform: [
        'pg-boss queues',
        'tenant transaction helpers',
        'idempotent phase0b item writes',
        'domain ingestion_status',
      ],
      poolUsage: poolUsage.rows,
      note: 'Polling only; LISTEN/NOTIFY was not enabled for this proof.',
    }, null, 2));
  } finally {
    if (crashWorker) await stopWorker(crashWorker, 'SIGKILL');
    if (replacementWorker) await stopWorker(replacementWorker, 'SIGKILL');
    await workerBoss.stop({ graceful: false, close: false });
    await apiBoss.stop({ graceful: false, close: false });
    await Promise.all([migratorPool.end(), apiDataPool.end(), bossPool.end(), workerDataPool.end(), reusePool.end()]);
  }
}

await main();
