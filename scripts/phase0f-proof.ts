import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { Client, Pool } from 'pg';

import { appendEvidenceTransition, createObservedEvidence, reconstructEvidence, type ObservationInput } from '../src/evidence/evidence-ledger';
import { tenantId, withTenantTransaction } from '../src/db/tenant-context';
import { putContentAddressedEvidence, type EvidenceStore } from '../src/storage/evidence-store';
import { LocalFilesystemEvidenceStore } from '../src/storage/local-filesystem-evidence-store';

const migratorUrl = process.env.PHASE0_MIGRATOR_DATABASE_URL ?? 'postgres://core_migrator:phase0-migrator-local-only@127.0.0.1:55432/mhoo_core_phase0';
const password = randomBytes(24).toString('base64url');
const apiUrl = `postgres://core_api:${password}@127.0.0.1:55432/mhoo_core_phase0`;
const a = tenantId('11111111-1111-4111-8111-111111111111');
const b = tenantId('22222222-2222-4222-8222-222222222222');

function proof(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function migrate(): Promise<void> {
  const client = new Client({ connectionString: migratorUrl }); await client.connect();
  try {
    await client.query('drop schema if exists pgboss cascade');
    await client.query('drop schema if exists core cascade');
    for (const role of ['core_api', 'core_worker', 'core_runtime']) await client.query(`drop role if exists ${role}`);
    for (const file of ['0001_phase0_core.sql', '0002_phase0_runtime_role.sql', '0003_phase0b_runtime_roles.sql', '0004_phase0b_mock_ingestion.sql', '0006_phase0f_evidence_ledger.sql']) await client.query(await readFile(path.join(process.cwd(), 'db/migrations', file), 'utf8'));
    await client.query(`alter role core_api login password '${password}'`);
    await client.query('insert into core.workspace_bindings (tenant_id, twenty_workspace_id) values ($1,$2),($3,$4)', [a, 'workspace-a', b, 'workspace-b']);
  } finally { await client.end(); }
}

async function main(): Promise<void> {
  await migrate();
  const root = await mkdtemp(path.join(tmpdir(), 'mhoo-phase0f-'));
  const store = new LocalFilesystemEvidenceStore(root);
  const body = new TextEncoder().encode('phase0f immutable evidence');
  const receipt = await putContentAddressedEvidence(store, { body, contentType: 'text/plain', sha256: createHash('sha256').update(body).digest('hex') });
  const revisedBody = new TextEncoder().encode('phase0f immutable evidence revision two');
  const revisedReceipt = await putContentAddressedEvidence(store, { body: revisedBody, contentType: 'text/plain', sha256: createHash('sha256').update(revisedBody).digest('hex') });
  const pool = new Pool({ connectionString: apiUrl, max: 4 });
  const input: ObservationInput = { tenantId: a, twentyWorkspaceIdReference: 'workspace-a', contentKey: receipt.key, contentType: 'text/plain', byteSize: body.byteLength, sourceSystem: 'fixture', sourceInstanceReference: 'fixture-a', externalObjectId: 'source-a', sourceRevision: 'r1', acquisitionMechanism: 'phase0f-proof', acquiredAt: '2026-08-23T00:00:00.000Z', observedAt: '2026-08-23T00:00:01.000Z', creationIdempotencyKey: 'delivery-a', actor: { kind: 'core_process', reference: 'phase0f-proof', version: '1' } };
  try {
    const creationRace = await Promise.all(Array.from({ length: 8 }, () => createObservedEvidence(pool, store, input)));
    const observed = creationRace.find((result) => result.created)!;
    proof(creationRace.filter((result) => result.created).length === 1 && new Set(creationRace.map((result) => result.evidenceId)).size === 1, 'Concurrent creation idempotency failed');
    const duplicate = await createObservedEvidence(pool, store, { ...input, acquiredAt: '2026-08-23T07:00:00.000+07:00', observedAt: '2026-08-23T07:00:01.000+07:00' });
    proof(observed.created && !duplicate.created && observed.evidenceId === duplicate.evidenceId, 'Creation idempotency failed');
    await assert.rejects(() => createObservedEvidence(pool, store, { ...input, acquiredAt: 'not-a-timestamp' }), /RFC 3339/u);
    const forgedReceiptStore: EvidenceStore = { exists: async () => true, get: async () => ({ body: new TextEncoder().encode('forged receipt bytes'), contentType: input.contentType, sha256: receipt.sha256 }), put: async () => ({ created: false }) };
    await assert.rejects(() => createObservedEvidence(pool, forgedReceiptStore, input), /body does not match/u);
    await assert.rejects(() => createObservedEvidence(pool, store, { ...input, contentType: 'application/json' }), /receipt does not match/u);
    await assert.rejects(() => createObservedEvidence(pool, store, { ...input, sourceRevision: 'r2' }), /idempotency integrity conflict/u);
    await assert.rejects(() => createObservedEvidence(pool, store, { ...input, contentKey: revisedReceipt.key, byteSize: revisedBody.byteLength }), /idempotency integrity conflict/u);
    const revisionTwo = await createObservedEvidence(pool, store, { ...input, contentKey: revisedReceipt.key, byteSize: revisedBody.byteLength, sourceRevision: 'r2', creationIdempotencyKey: 'delivery-a-r2' });
    proof(revisionTwo.created && revisionTwo.evidenceId !== observed.evidenceId, 'A new source revision did not create a distinct observation');
    const tenantBObservation = await createObservedEvidence(pool, store, { ...input, tenantId: b, twentyWorkspaceIdReference: 'workspace-b' });
    proof(tenantBObservation.created && tenantBObservation.evidenceId !== observed.evidenceId, 'The same blob did not remain a distinct tenant observation');

    await withTenantTransaction(pool, a, async (client) => {
      await assert.rejects(() => client.query('update core.evidence_lifecycle_heads set current_state = $1 where evidence_id = $2', ['recorded', observed.evidenceId]), /lifecycle head does not match/u);
    });

    const recordedReason = { code: 'receipt-validated', detail: 'phase0d receipt and tenant binding verified', sourceClaim: null };
    const recorded = await appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, expectedPriorState: 'observed', newState: 'recorded', idempotencyKey: 'record-a', actor: input.actor, reason: recordedReason });
    const retried = await appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, expectedPriorState: 'observed', newState: 'recorded', idempotencyKey: 'record-a', actor: input.actor, reason: recordedReason });
    proof(recorded.created && !retried.created, 'Transition idempotency failed');
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, expectedPriorState: 'observed', newState: 'recorded', idempotencyKey: 'record-a', actor: input.actor, reason: { code: 'receipt-validated', detail: 'changed reason must not be accepted as a retry', sourceClaim: null } }), /idempotency integrity conflict/u);
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-without-replacement', actor: input.actor, reason: { code: 'replacement-required', detail: 'must have a replacement', sourceClaim: null } }), /requires replacement evidence/u);
    const race = await Promise.allSettled(['retracted', 'invalidated'].map((newState) => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: newState as 'retracted' | 'invalidated', idempotencyKey: `race-${newState}`, actor: input.actor, reason: { code: 'concurrency-proof', detail: null, sourceClaim: null } })));
    proof(race.filter((result) => result.status === 'fulfilled').length === 1 && race.filter((result) => result.status === 'rejected').length === 1, 'No-fork transition proof failed');
    await withTenantTransaction(pool, a, async (client) => {
      const custody = await reconstructEvidence(client, observed.evidenceId);
      proof(custody.events.length === 3 && custody.record.content_key === receipt.key && custody.head.current_event_id === custody.events[2]?.provenance_event_id, 'Reconstruction did not retain receipt, ordered event history, and current projection');
      await assert.rejects(() => client.query('update core.evidence_provenance_events set actor_reference = $1 where evidence_id = $2', ['tamper', observed.evidenceId]));
      await assert.rejects(() => client.query('delete from core.evidence_records where evidence_id = $1', [observed.evidenceId]));
    });
    const migrator = new Client({ connectionString: migratorUrl });
    await migrator.connect();
    try {
      await assert.rejects(() => migrator.query('update core.evidence_records set source_system = $1 where evidence_id = $2', ['tamper', observed.evidenceId]), /append-only/u);
      await assert.rejects(() => migrator.query('delete from core.evidence_provenance_events where evidence_id = $1', [observed.evidenceId]), /append-only/u);
    } finally { await migrator.end(); }
    const noContext = await pool.query('select count(*)::text as count from core.evidence_records');
    proof(noContext.rows[0]?.count === '0', 'Tenant context leaked after evidence operations');
    await withTenantTransaction(pool, a, async (client) => proof((await client.query('select count(*)::text as count from core.evidence_records')).rows[0]?.count === '2', 'Tenant A did not retain only its two observations'));
    await withTenantTransaction(pool, b, async (client) => proof((await client.query('select count(*)::text as count from core.evidence_records')).rows[0]?.count === '1', 'Tenant B did not retain only its one observation'));
    console.log(JSON.stringify({ verdict: { 'TENANT RLS PERSISTENCE': 'PASS', 'IMMUTABLE EVIDENCE CREATION': 'PASS', 'APPEND-ONLY LEDGER': 'PASS', 'ATOMIC NO-FORK TRANSITIONS': 'PASS', 'DETERMINISTIC IDEMPOTENCY': 'PASS', 'PHASE 0D RECEIPT VERIFICATION': 'PASS', 'RECONSTRUCTION': 'PASS' } }));
  } finally { await pool.end(); }
  await rm(root, { recursive: true, force: true });
}
await main();
