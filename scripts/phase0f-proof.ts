import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { Client, Pool } from 'pg';

import { appendEvidenceTransition, createObservedEvidence, reconstructEvidence, validateAndRecordEvidence, type ObservationInput } from '../src/evidence/evidence-ledger';
import { tenantId, withTenantTransaction } from '../src/db/tenant-context';
import { putContentAddressedEvidence, type EvidenceStore } from '../src/storage/evidence-store';
import { LocalFilesystemEvidenceStore } from '../src/storage/local-filesystem-evidence-store';

const migratorUrl = process.env.PHASE0_MIGRATOR_DATABASE_URL ?? 'postgres://core_migrator:phase0-migrator-local-only@127.0.0.1:55432/mhoo_core_phase0';
const password = randomBytes(24).toString('base64url');
const apiUrl = `postgres://core_api:${password}@127.0.0.1:55432/mhoo_core_phase0`;
const a = tenantId('11111111-1111-4111-8111-111111111111');
const b = tenantId('22222222-2222-4222-8222-222222222222');

function proof(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}
function eventPayloadHash(payload: Record<string, unknown>): string { return createHash('sha256').update(`mhoo.evidence.provenance-event-payload.v1|${canonicalJson(payload)}`).digest('hex'); }
function timestamp(value: unknown): string { return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString(); }

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
    const creationRace = await Promise.all(Array.from({ length: 8 }, () => createObservedEvidence(pool, input)));
    const observed = creationRace.find((result) => result.created)!;
    proof(creationRace.filter((result) => result.created).length === 1 && new Set(creationRace.map((result) => result.evidenceId)).size === 1, 'Concurrent creation idempotency failed');
    const duplicate = await createObservedEvidence(pool, { ...input, acquiredAt: '2026-08-23T07:00:00.000+07:00', observedAt: '2026-08-23T07:00:01.000+07:00' });
    proof(observed.created && !duplicate.created && observed.evidenceId === duplicate.evidenceId, 'Creation idempotency failed');
    await assert.rejects(() => createObservedEvidence(pool, { ...input, acquiredAt: 'not-a-timestamp' }), /RFC 3339/u);
    await assert.rejects(() => createObservedEvidence(pool, { ...input, actor: { ...input.actor, reference: 'changed-initial-actor' } }), /idempotency integrity conflict/u);
    const forgedReceiptStore: EvidenceStore = { exists: async () => true, get: async () => ({ body: new TextEncoder().encode('forged receipt bytes'), contentType: input.contentType, sha256: receipt.sha256 }), put: async () => ({ created: false }) };
    const forgedObserved = await createObservedEvidence(pool, { ...input, creationIdempotencyKey: 'delivery-forged' });
    const forgedInvalidated = await validateAndRecordEvidence(pool, forgedReceiptStore, a, { evidenceId: forgedObserved.evidenceId, expectedPredecessorEventId: forgedObserved.eventId, idempotencyKey: 'validate-forged', actor: input.actor });
    proof(forgedObserved.state === 'observed' && forgedInvalidated.state === 'invalidated' && forgedInvalidated.sequence === 2, 'Failed receipt validation did not retain observed custody then invalidate it');
    const metadataMismatch = await createObservedEvidence(pool, { ...input, contentType: 'application/json', creationIdempotencyKey: 'delivery-metadata-mismatch' });
    const metadataInvalidated = await validateAndRecordEvidence(pool, store, a, { evidenceId: metadataMismatch.evidenceId, expectedPredecessorEventId: metadataMismatch.eventId, idempotencyKey: 'validate-metadata-mismatch', actor: input.actor });
    proof(metadataInvalidated.state === 'invalidated', 'Content metadata mismatch did not invalidate the observed custody record');
    await assert.rejects(() => createObservedEvidence(pool, { ...input, sourceRevision: 'r2' }), /idempotency integrity conflict/u);
    await assert.rejects(() => createObservedEvidence(pool, { ...input, contentKey: revisedReceipt.key, byteSize: revisedBody.byteLength }), /idempotency integrity conflict/u);
    const revisionTwo = await createObservedEvidence(pool, { ...input, contentKey: revisedReceipt.key, byteSize: revisedBody.byteLength, sourceRevision: 'r2', creationIdempotencyKey: 'delivery-a-r2' });
    proof(revisionTwo.created && revisionTwo.evidenceId !== observed.evidenceId, 'A new source revision did not create a distinct observation');
    const tenantBObservation = await createObservedEvidence(pool, { ...input, tenantId: b, twentyWorkspaceIdReference: 'workspace-b' });
    proof(tenantBObservation.created && tenantBObservation.evidenceId !== observed.evidenceId, 'The same blob did not remain a distinct tenant observation');

    await withTenantTransaction(pool, a, async (client) => {
      await assert.rejects(() => client.query('update core.evidence_lifecycle_heads set current_state = $1 where evidence_id = $2', ['recorded', observed.evidenceId]), /lifecycle head does not match/u);
    });

    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, expectedPriorState: 'observed', newState: 'recorded', idempotencyKey: 'record-a', actor: input.actor, reason: { code: 'receipt-validated', detail: null, sourceClaim: null } }), /requires validateAndRecordEvidence/u);
    const recorded = await validateAndRecordEvidence(pool, store, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, idempotencyKey: 'record-a', actor: input.actor });
    const retried = await validateAndRecordEvidence(pool, store, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, idempotencyKey: 'record-a', actor: input.actor });
    proof(recorded.created && !retried.created, 'Transition idempotency failed');
    await assert.rejects(() => validateAndRecordEvidence(pool, store, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: observed.eventId, idempotencyKey: 'record-a', actor: { ...input.actor, executionReference: 'changed-record-retry' } }), /idempotency integrity conflict/u);
    const revisionTwoRecorded = await validateAndRecordEvidence(pool, store, a, { evidenceId: revisionTwo.evidenceId, expectedPredecessorEventId: revisionTwo.eventId, idempotencyKey: 'record-r2', actor: input.actor });
    const tenantBRecorded = await validateAndRecordEvidence(pool, store, b, { evidenceId: tenantBObservation.evidenceId, expectedPredecessorEventId: tenantBObservation.eventId, idempotencyKey: 'record-b', actor: input.actor });
    const unrecorded = await createObservedEvidence(pool, { ...input, externalObjectId: 'source-unrecorded', creationIdempotencyKey: 'delivery-unrecorded' });
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-without-replacement', actor: input.actor, reason: { code: 'replacement-required', detail: 'must have a replacement', sourceClaim: null } }), /requires replacement evidence/u);
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-nonexistent', actor: input.actor, relatedEvidenceId: '33333333-3333-4333-8333-333333333333', reason: { code: 'replacement-required', detail: null, sourceClaim: null } }), /same-tenant recorded replacement/u);
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-cross-tenant', actor: input.actor, relatedEvidenceId: tenantBRecorded.evidenceId, reason: { code: 'replacement-required', detail: null, sourceClaim: null } }), /same-tenant recorded replacement/u);
    await assert.rejects(() => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-unrecorded', actor: input.actor, relatedEvidenceId: unrecorded.evidenceId, reason: { code: 'replacement-required', detail: null, sourceClaim: null } }), /same-tenant recorded replacement/u);
    const superseded = await appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: recorded.eventId, expectedPriorState: 'recorded', newState: 'superseded', idempotencyKey: 'supersede-recorded-r2', actor: input.actor, relatedEvidenceId: revisionTwoRecorded.evidenceId, reason: { code: 'newer-source-revision', detail: 'r2 supersedes r1', sourceClaim: null } });
    proof(superseded.state === 'superseded' && superseded.created, 'Recorded same-tenant replacement did not supersede the prior evidence');
    const race = await Promise.allSettled(['retracted', 'invalidated'].map((newState) => appendEvidenceTransition(pool, a, { evidenceId: observed.evidenceId, expectedPredecessorEventId: superseded.eventId, expectedPriorState: 'superseded', newState: newState as 'retracted' | 'invalidated', idempotencyKey: `race-${newState}`, actor: input.actor, relatedEvidenceId: newState === 'retracted' ? revisionTwoRecorded.evidenceId : undefined, reason: { code: 'concurrency-proof', detail: null, sourceClaim: null } })));
    proof(race.filter((result) => result.status === 'fulfilled').length === 1 && race.filter((result) => result.status === 'rejected').length === 1, 'No-fork transition proof failed');
    await withTenantTransaction(pool, a, async (client) => {
      const custody = await reconstructEvidence(client, observed.evidenceId);
      const initialEvent = custody.events[0]!;
      const initialPayload = { provenanceEventId: initialEvent.provenance_event_id, evidenceId: initialEvent.evidence_id, tenantId: initialEvent.tenant_id, eventType: initialEvent.event_type, lifecycleSequence: initialEvent.lifecycle_sequence, predecessorEventId: initialEvent.predecessor_event_id, idempotencyKey: initialEvent.idempotency_key, eventOccurredAt: timestamp(initialEvent.event_occurred_at), recordedAt: timestamp(initialEvent.recorded_at), actor: { kind: initialEvent.actor_kind, reference: initialEvent.actor_reference, version: initialEvent.actor_version, executionReference: initialEvent.execution_reference }, priorLifecycleState: initialEvent.prior_lifecycle_state, newLifecycleState: initialEvent.new_lifecycle_state, causationEventId: initialEvent.causation_event_id, relatedEvidenceId: initialEvent.related_evidence_id, externalCauseReference: initialEvent.external_cause_reference, correlationReference: initialEvent.correlation_reference, provenanceSnapshotOrTypedReason: initialEvent.provenance_snapshot_or_typed_reason };
      proof(initialEvent.event_payload_sha256 === eventPayloadHash(initialPayload) && initialEvent.event_payload_sha256 !== eventPayloadHash({ ...initialPayload, recordedAt: '2000-01-01T00:00:00.000Z' }), 'Event payload hash does not bind recorded_at');
      proof(custody.events.length === 4
        && custody.record.content_key === receipt.key
        && custody.record.content_sha256 === receipt.sha256
        && custody.record.content_type === 'text/plain'
        && Number(custody.record.byte_size) === body.byteLength
        && custody.record.tenant_id === a
        && custody.record.twenty_workspace_id_reference === 'workspace-a'
        && custody.record.source_system === 'fixture'
        && custody.record.external_object_id === 'source-a'
        && custody.record.source_revision === 'r1'
        && custody.record.acquisition_mechanism === 'phase0f-proof'
        && custody.events[2]?.related_evidence_id === revisionTwoRecorded.evidenceId
        && custody.head.current_event_id === custody.events[3]?.provenance_event_id,
      'Reconstruction did not answer the receipt, scope, provenance, transition, and current-state questions');
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
    await withTenantTransaction(pool, a, async (client) => proof((await client.query('select count(*)::text as count from core.evidence_records')).rows[0]?.count === '5', 'Tenant A did not retain only its five observations'));
    await withTenantTransaction(pool, b, async (client) => proof((await client.query('select count(*)::text as count from core.evidence_records')).rows[0]?.count === '1', 'Tenant B did not retain only its one observation'));
    console.log(JSON.stringify({ verdict: { 'TENANT RLS PERSISTENCE': 'PASS', 'IMMUTABLE EVIDENCE CREATION': 'PASS', 'OBSERVED TO RECORDED VALIDATION BOUNDARY': 'PASS', 'APPEND-ONLY LEDGER': 'PASS', 'ATOMIC NO-FORK TRANSITIONS': 'PASS', 'DETERMINISTIC IDEMPOTENCY': 'PASS', 'RECORDED_AT PAYLOAD BINDING': 'PASS', 'SUPERSESSION INTEGRITY': 'PASS', 'PHASE 0D RECEIPT VERIFICATION': 'PASS', 'FIVE-QUESTION RECONSTRUCTION': 'PASS' } }));
  } finally { await pool.end(); }
  await rm(root, { recursive: true, force: true });
}
await main();
