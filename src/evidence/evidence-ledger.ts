import { createHash, randomBytes } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { contentAddressedEvidenceKey, verifyEvidenceObjectAtKey, type EvidenceStore } from '../storage/evidence-store';
import { type TenantId, withTenantTransaction } from '../db/tenant-context';

export type LifecycleState = 'observed' | 'recorded' | 'superseded' | 'retracted' | 'invalidated';
export type ActorKind = 'connector' | 'importer' | 'core_process' | 'retention_policy';
export type TypedReason = { code: string; detail: string | null; sourceClaim: string | null };

export type ObservationInput = {
  tenantId: TenantId;
  twentyWorkspaceIdReference: string;
  contentKey: string;
  contentType: string;
  byteSize: number;
  sourceSystem: string;
  sourceInstanceReference?: string;
  externalObjectId: string;
  sourceRevision?: string;
  originalReferenceUri?: string;
  acquisitionMechanism: string;
  acquiredAt: string;
  observedAt: string;
  sourceCreatedAt?: string;
  sourceUpdatedAt?: string;
  creationIdempotencyKey: string;
  actor: { kind: ActorKind; reference: string; version: string; executionReference?: string };
};

export type TransitionInput = {
  evidenceId: string;
  expectedPredecessorEventId: string;
  expectedPriorState: LifecycleState;
  newState: Exclude<LifecycleState, 'observed'>;
  idempotencyKey: string;
  actor: { kind: ActorKind; reference: string; version: string; executionReference?: string };
  eventOccurredAt?: string;
  relatedEvidenceId?: string;
  causationEventId?: string;
  externalCauseReference?: string;
  correlationReference?: string;
  reason: TypedReason;
};

export type ValidateAndRecordInput = {
  evidenceId: string;
  expectedPredecessorEventId: string;
  idempotencyKey: string;
  actor: { kind: ActorKind; reference: string; version: string; executionReference?: string };
  eventOccurredAt?: string;
};

export type EvidenceResult = { evidenceId: string; eventId: string; state: LifecycleState; sequence: number; created: boolean };

class CustodyValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CustodyValidationError';
  }
}

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function nullable(value: string | undefined): string | null { return value ?? null; }
function lengthPrefixed(values: Array<string | number | null>): string { return values.map((value) => { const text = value === null ? '<null>' : String(value); return `${Buffer.byteLength(text)}:${text}`; }).join('|'); }
function canonicalActor(actor: ObservationInput['actor']): { kind: ActorKind; reference: string; version: string; executionReference: string | null } { return { kind: actor.kind, reference: actor.reference, version: actor.version, executionReference: nullable(actor.executionReference) }; }

function normalizeTimestamp(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    throw new Error('Evidence timestamps must be valid RFC 3339 instants');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error('Evidence timestamps must be valid RFC 3339 instants');
  return parsed.toISOString();
}

function normalizeObservationInput(input: ObservationInput): ObservationInput {
  return {
    ...input,
    acquiredAt: normalizeTimestamp(input.acquiredAt),
    observedAt: normalizeTimestamp(input.observedAt),
    sourceCreatedAt: input.sourceCreatedAt ? normalizeTimestamp(input.sourceCreatedAt) : undefined,
    sourceUpdatedAt: input.sourceUpdatedAt ? normalizeTimestamp(input.sourceUpdatedAt) : undefined,
  };
}

function normalizeReason(reason: TypedReason): TypedReason {
  const candidate = reason as Record<string, unknown>;
  if (Object.keys(candidate).sort().join(',') !== 'code,detail,sourceClaim'
    || typeof candidate.code !== 'string' || !candidate.code
    || (candidate.detail !== null && typeof candidate.detail !== 'string')
    || (candidate.sourceClaim !== null && typeof candidate.sourceClaim !== 'string')) {
    throw new Error('Evidence transition reason must use the fixed typed-reason shape');
  }
  return { code: candidate.code, detail: candidate.detail as string | null, sourceClaim: candidate.sourceClaim as string | null };
}

function normalizeTransitionInput(input: TransitionInput): TransitionInput {
  return { ...input, reason: normalizeReason(input.reason), eventOccurredAt: input.eventOccurredAt ? normalizeTimestamp(input.eventOccurredAt) : undefined };
}

function uuidV7(): string {
  const milliseconds = Date.now().toString(16).padStart(12, '0');
  const random = randomBytes(10).toString('hex');
  const variant = (8 + (Number.parseInt(random[3]!, 16) % 4)).toString(16);
  return `${milliseconds.slice(0, 8)}-${milliseconds.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(4, 7)}-${random.slice(7, 19)}`;
}

function eventId(tenantId: string, evidenceId: string, predecessor: string | null, sequence: number, eventType: string, actor: ObservationInput['actor'], idempotencyKey: string): string {
  return hash(`mhoo.evidence.provenance-event.v1|${lengthPrefixed([tenantId, evidenceId, predecessor, sequence, eventType, actor.kind, actor.reference, idempotencyKey])}`);
}

function creationPayload(input: ObservationInput, sha256: string): Record<string, unknown> {
  return { tenantId: input.tenantId, twentyWorkspaceIdReference: input.twentyWorkspaceIdReference, contentKey: input.contentKey, contentSha256: sha256, contentType: input.contentType, byteSize: input.byteSize, sourceSystem: input.sourceSystem, sourceInstanceReference: nullable(input.sourceInstanceReference), externalObjectId: input.externalObjectId, sourceRevision: nullable(input.sourceRevision), originalReferenceUri: nullable(input.originalReferenceUri), acquisitionMechanism: input.acquisitionMechanism, acquiredAt: input.acquiredAt, observedAt: input.observedAt, sourceCreatedAt: nullable(input.sourceCreatedAt), sourceUpdatedAt: nullable(input.sourceUpdatedAt), creationIdempotencyKey: input.creationIdempotencyKey };
}

function payloadHash(payload: Record<string, unknown>): string { return hash(`mhoo.evidence.provenance-event-payload.v1|${canonicalJson(payload)}`); }

function claimedSha256(contentKey: string): string {
  const match = /^sha256\/([a-f0-9]{64})$/u.exec(contentKey);
  if (!match) throw new Error('Evidence content key must be a canonical sha256 address');
  return match[1]!;
}

function recordedAt(): string { return new Date().toISOString(); }
function storedTimestamp(value: string | Date): string { return normalizeTimestamp(value instanceof Date ? value.toISOString() : value); }

function eventPayload(args: {
  provenanceEventId: string;
  evidenceId: string;
  tenantId: string;
  eventType: string;
  lifecycleSequence: number;
  predecessorEventId: string | null;
  idempotencyKey: string;
  eventOccurredAt: string | undefined;
  recordedAt: string;
  actor: ObservationInput['actor'];
  priorLifecycleState: LifecycleState | null;
  newLifecycleState: LifecycleState;
  causationEventId?: string;
  relatedEvidenceId?: string;
  externalCauseReference?: string;
  correlationReference?: string;
  provenanceSnapshotOrTypedReason: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    provenanceEventId: args.provenanceEventId,
    evidenceId: args.evidenceId,
    tenantId: args.tenantId,
    eventType: args.eventType,
    lifecycleSequence: args.lifecycleSequence,
    predecessorEventId: args.predecessorEventId,
    idempotencyKey: args.idempotencyKey,
    eventOccurredAt: nullable(args.eventOccurredAt),
    recordedAt: args.recordedAt,
    actor: canonicalActor(args.actor),
    priorLifecycleState: args.priorLifecycleState,
    newLifecycleState: args.newLifecycleState,
    causationEventId: nullable(args.causationEventId),
    relatedEvidenceId: nullable(args.relatedEvidenceId),
    externalCauseReference: nullable(args.externalCauseReference),
    correlationReference: nullable(args.correlationReference),
    provenanceSnapshotOrTypedReason: args.provenanceSnapshotOrTypedReason,
  };
}

function legalTransition(prior: LifecycleState, next: LifecycleState): boolean {
  return (prior === 'observed' && (next === 'recorded' || next === 'invalidated'))
    || (prior === 'recorded' && (next === 'superseded' || next === 'retracted' || next === 'invalidated'))
    || (prior === 'superseded' && (next === 'retracted' || next === 'invalidated'))
    || (prior === 'retracted' && next === 'invalidated');
}

async function verifyReceipt(store: EvidenceStore, receipt: { contentKey: string; contentSha256: string; contentType: string; byteSize: number }): Promise<void> {
  const object = await store.get(receipt.contentKey);
  if (!object) throw new CustodyValidationError('Evidence object is absent from the configured store');
  try {
    verifyEvidenceObjectAtKey(receipt.contentKey, object);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Evidence object integrity check failed';
    throw new CustodyValidationError(detail);
  }
  if (receipt.contentKey !== contentAddressedEvidenceKey(object.sha256)
    || receipt.contentSha256 !== object.sha256
    || receipt.contentType !== object.contentType
    || receipt.byteSize !== object.body.byteLength) throw new CustodyValidationError('Evidence receipt does not match the immutable object');
}

async function findRetriedTransition(client: PoolClient, tenantId: TenantId, input: TransitionInput): Promise<EvidenceResult | undefined> {
  const retried = await client.query<{ provenance_event_id: string; event_payload_sha256: string; lifecycle_sequence: number; recorded_at: string | Date }>(
    'select provenance_event_id, event_payload_sha256, lifecycle_sequence, recorded_at from core.evidence_provenance_events where evidence_id = $1 and predecessor_event_id = $2 and event_type = $3 and idempotency_key = $4',
    [input.evidenceId, input.expectedPredecessorEventId, `evidence.${input.newState}`, input.idempotencyKey],
  );
  if (!retried.rowCount) return undefined;

  const existing = retried.rows[0]!;
  const expectedId = eventId(tenantId, input.evidenceId, input.expectedPredecessorEventId, existing.lifecycle_sequence, `evidence.${input.newState}`, input.actor, input.idempotencyKey);
  const retryPayload = eventPayload({ provenanceEventId: expectedId, evidenceId: input.evidenceId, tenantId, eventType: `evidence.${input.newState}`, lifecycleSequence: existing.lifecycle_sequence, predecessorEventId: input.expectedPredecessorEventId, idempotencyKey: input.idempotencyKey, eventOccurredAt: input.eventOccurredAt, recordedAt: storedTimestamp(existing.recorded_at), actor: input.actor, priorLifecycleState: input.expectedPriorState, newLifecycleState: input.newState, causationEventId: input.causationEventId, relatedEvidenceId: input.relatedEvidenceId, externalCauseReference: input.externalCauseReference, correlationReference: input.correlationReference, provenanceSnapshotOrTypedReason: input.reason });
  if (existing.provenance_event_id !== expectedId || existing.event_payload_sha256 !== payloadHash(retryPayload)) throw new Error('Evidence event idempotency integrity conflict');
  return { evidenceId: input.evidenceId, eventId: existing.provenance_event_id, state: input.newState, sequence: existing.lifecycle_sequence, created: false };
}

export async function createObservedEvidence(pool: Pool, input: ObservationInput): Promise<EvidenceResult> {
  const normalizedInput = normalizeObservationInput(input);
  const sha256 = claimedSha256(normalizedInput.contentKey);
  const creation = creationPayload(normalizedInput, sha256);
  const creationHash = hash(`mhoo.evidence.creation-payload.v1|${canonicalJson(creation)}`);
  return withTenantTransaction(pool, normalizedInput.tenantId, async (client) => {
    // Serializes only commands with the same declared idempotency identity.
    // The database unique constraint remains the durable backstop.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${normalizedInput.tenantId}|${normalizedInput.acquisitionMechanism}|${normalizedInput.creationIdempotencyKey}`]);
    const binding = await client.query('select twenty_workspace_id from core.workspace_bindings where tenant_id = $1 and twenty_workspace_id = $2', [normalizedInput.tenantId, normalizedInput.twentyWorkspaceIdReference]);
    if (binding.rowCount !== 1) throw new Error('Trusted tenant-to-Workspace binding is absent');
    const prior = await client.query<{ evidence_id: string; initial_provenance_event_id: string; creation_payload_sha256: string }>('select evidence_id, initial_provenance_event_id, creation_payload_sha256 from core.evidence_records where acquisition_mechanism = $1 and creation_idempotency_key = $2', [normalizedInput.acquisitionMechanism, normalizedInput.creationIdempotencyKey]);
    if (prior.rowCount) {
      const existing = prior.rows[0]!;
      if (existing.creation_payload_sha256 !== creationHash) throw new Error('Evidence creation idempotency integrity conflict');
      const initial = await client.query<{ provenance_event_id: string; event_payload_sha256: string; recorded_at: string | Date }>('select provenance_event_id, event_payload_sha256, recorded_at from core.evidence_provenance_events where provenance_event_id = $1', [existing.initial_provenance_event_id]);
      if (initial.rowCount !== 1) throw new Error('Evidence creation idempotency integrity conflict');
      const initialEvent = initial.rows[0]!;
      const expectedId = eventId(normalizedInput.tenantId, existing.evidence_id, null, 1, 'evidence.observed', normalizedInput.actor, normalizedInput.creationIdempotencyKey);
      const expectedPayload = eventPayload({ provenanceEventId: expectedId, evidenceId: existing.evidence_id, tenantId: normalizedInput.tenantId, eventType: 'evidence.observed', lifecycleSequence: 1, predecessorEventId: null, idempotencyKey: normalizedInput.creationIdempotencyKey, eventOccurredAt: normalizedInput.observedAt, recordedAt: storedTimestamp(initialEvent.recorded_at), actor: normalizedInput.actor, priorLifecycleState: null, newLifecycleState: 'observed', provenanceSnapshotOrTypedReason: creation });
      if (initialEvent.provenance_event_id !== expectedId || initialEvent.event_payload_sha256 !== payloadHash(expectedPayload)) throw new Error('Evidence creation idempotency integrity conflict');
      return { evidenceId: existing.evidence_id, eventId: existing.initial_provenance_event_id, state: 'observed', sequence: 1, created: false };
    }
    const evidenceId = uuidV7();
    const eventType = 'evidence.observed';
    const eventIdValue = eventId(normalizedInput.tenantId, evidenceId, null, 1, eventType, normalizedInput.actor, normalizedInput.creationIdempotencyKey);
    const appendTimestamp = recordedAt();
    const initialPayload = eventPayload({ provenanceEventId: eventIdValue, evidenceId, tenantId: normalizedInput.tenantId, eventType, lifecycleSequence: 1, predecessorEventId: null, idempotencyKey: normalizedInput.creationIdempotencyKey, eventOccurredAt: normalizedInput.observedAt, recordedAt: appendTimestamp, actor: normalizedInput.actor, priorLifecycleState: null, newLifecycleState: 'observed', provenanceSnapshotOrTypedReason: creation });
    const eventHash = payloadHash(initialPayload);
    await client.query(`insert into core.evidence_records (evidence_id, tenant_id, twenty_workspace_id_reference, content_key, content_sha256, content_type, byte_size, source_system, source_instance_reference, external_object_id, source_revision, original_reference_uri, acquisition_mechanism, acquired_at, observed_at, source_created_at, source_updated_at, creation_idempotency_key, creation_payload_sha256, initial_provenance_event_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [evidenceId,normalizedInput.tenantId,normalizedInput.twentyWorkspaceIdReference,normalizedInput.contentKey,sha256,normalizedInput.contentType,normalizedInput.byteSize,normalizedInput.sourceSystem,nullable(normalizedInput.sourceInstanceReference),normalizedInput.externalObjectId,nullable(normalizedInput.sourceRevision),nullable(normalizedInput.originalReferenceUri),normalizedInput.acquisitionMechanism,normalizedInput.acquiredAt,normalizedInput.observedAt,nullable(normalizedInput.sourceCreatedAt),nullable(normalizedInput.sourceUpdatedAt),normalizedInput.creationIdempotencyKey,creationHash,eventIdValue]);
    await client.query(`insert into core.evidence_provenance_events (provenance_event_id,evidence_id,tenant_id,event_type,lifecycle_sequence,predecessor_event_id,idempotency_key,event_occurred_at,recorded_at,actor_kind,actor_reference,actor_version,execution_reference,prior_lifecycle_state,new_lifecycle_state,provenance_snapshot_or_typed_reason,event_payload_sha256) values ($1,$2,$3,$4,1,null,$5,$6,$7,$8,$9,$10,$11,null,'observed',$12::jsonb,$13)`, [eventIdValue,evidenceId,normalizedInput.tenantId,eventType,normalizedInput.creationIdempotencyKey,normalizedInput.observedAt,appendTimestamp,normalizedInput.actor.kind,normalizedInput.actor.reference,normalizedInput.actor.version,nullable(normalizedInput.actor.executionReference),JSON.stringify(creation),eventHash]);
    await client.query('insert into core.evidence_lifecycle_heads (evidence_id, tenant_id, current_event_id, current_state, lifecycle_sequence) values ($1,$2,$3,$4,1)', [evidenceId,normalizedInput.tenantId,eventIdValue,'observed']);
    return { evidenceId, eventId: eventIdValue, state: 'observed', sequence: 1, created: true };
  });
}

export async function appendEvidenceTransition(pool: Pool, tenantId: TenantId, input: TransitionInput): Promise<EvidenceResult> {
  if (input.newState === 'recorded') throw new Error('Evidence recording requires validateAndRecordEvidence');
  return withTenantTransaction(pool, tenantId, async (client) => appendTransition(client, tenantId, normalizeTransitionInput(input)));
}

async function appendTransition(client: PoolClient, tenantId: TenantId, input: TransitionInput): Promise<EvidenceResult> {
  const priorRetry = await findRetriedTransition(client, tenantId, input);
  if (priorRetry) return priorRetry;
  const head = await client.query<{ current_event_id: string; current_state: LifecycleState; lifecycle_sequence: number }>('select current_event_id, current_state, lifecycle_sequence from core.evidence_lifecycle_heads where evidence_id = $1 for update', [input.evidenceId]);
  const lockedRetry = await findRetriedTransition(client, tenantId, input);
  if (lockedRetry) return lockedRetry;
  if (head.rowCount !== 1) throw new Error('Evidence lifecycle head is absent');
  const current = head.rows[0]!;
  if (current.current_event_id !== input.expectedPredecessorEventId || current.current_state !== input.expectedPriorState) throw new Error('Evidence lifecycle conflict: stale predecessor or prior state');
  if (!legalTransition(current.current_state, input.newState)) throw new Error('Evidence lifecycle transition is not legal');
  if (input.causationEventId) {
    const causation = await client.query('select 1 from core.evidence_provenance_events where provenance_event_id = $1 and tenant_id = $2', [input.causationEventId, tenantId]);
    if (causation.rowCount !== 1) throw new Error('Evidence event causation reference must resolve within the tenant');
  }
  if (input.relatedEvidenceId) {
    const related = await client.query('select 1 from core.evidence_records where evidence_id = $1 and tenant_id = $2', [input.relatedEvidenceId, tenantId]);
    if (related.rowCount !== 1) throw new Error('Evidence event related evidence reference must resolve within the tenant');
  }
  if (input.newState === 'superseded') {
    if (!input.relatedEvidenceId) throw new Error('Superseded evidence requires replacement evidence');
    const replacement = await client.query<{ evidence_id: string; current_state: LifecycleState }>('select evidence_id, current_state from core.evidence_lifecycle_heads where evidence_id = $1 and tenant_id = $2 for share', [input.relatedEvidenceId, tenantId]);
    if (replacement.rowCount !== 1 || replacement.rows[0]!.evidence_id === input.evidenceId || replacement.rows[0]!.current_state !== 'recorded') {
      throw new Error('Superseded evidence requires a same-tenant recorded replacement evidence');
    }
  }
  const sequence = current.lifecycle_sequence + 1;
  const eventType = `evidence.${input.newState}`;
  const eventIdValue = eventId(tenantId, input.evidenceId, current.current_event_id, sequence, eventType, input.actor, input.idempotencyKey);
  const reason = input.reason;
  const appendTimestamp = recordedAt();
  const payload = eventPayload({ provenanceEventId: eventIdValue, evidenceId: input.evidenceId, tenantId, eventType, lifecycleSequence: sequence, predecessorEventId: current.current_event_id, idempotencyKey: input.idempotencyKey, eventOccurredAt: input.eventOccurredAt, recordedAt: appendTimestamp, actor: input.actor, priorLifecycleState: current.current_state, newLifecycleState: input.newState, causationEventId: input.causationEventId, relatedEvidenceId: input.relatedEvidenceId, externalCauseReference: input.externalCauseReference, correlationReference: input.correlationReference, provenanceSnapshotOrTypedReason: reason });
  const eventHash = payloadHash(payload);
  const duplicate = await client.query<{ event_payload_sha256: string }>('select event_payload_sha256 from core.evidence_provenance_events where provenance_event_id = $1', [eventIdValue]);
  if (duplicate.rowCount) {
    if (duplicate.rows[0]!.event_payload_sha256 !== eventHash) throw new Error('Evidence event idempotency integrity conflict');
    return { evidenceId: input.evidenceId, eventId: eventIdValue, state: input.newState, sequence, created: false };
  }
  await client.query(`insert into core.evidence_provenance_events (provenance_event_id,evidence_id,tenant_id,event_type,lifecycle_sequence,predecessor_event_id,idempotency_key,event_occurred_at,recorded_at,actor_kind,actor_reference,actor_version,execution_reference,prior_lifecycle_state,new_lifecycle_state,causation_event_id,related_evidence_id,external_cause_reference,correlation_reference,provenance_snapshot_or_typed_reason,event_payload_sha256) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21)`, [eventIdValue,input.evidenceId,tenantId,eventType,sequence,current.current_event_id,input.idempotencyKey,nullable(input.eventOccurredAt),appendTimestamp,input.actor.kind,input.actor.reference,input.actor.version,nullable(input.actor.executionReference),current.current_state,input.newState,nullable(input.causationEventId),nullable(input.relatedEvidenceId),nullable(input.externalCauseReference),nullable(input.correlationReference),JSON.stringify(reason),eventHash]);
  await client.query('update core.evidence_lifecycle_heads set current_event_id = $1, current_state = $2, lifecycle_sequence = $3 where evidence_id = $4', [eventIdValue,input.newState,sequence,input.evidenceId]);
  return { evidenceId: input.evidenceId, eventId: eventIdValue, state: input.newState, sequence, created: true };
}

export async function validateAndRecordEvidence(pool: Pool, store: EvidenceStore, tenantId: TenantId, input: ValidateAndRecordInput): Promise<EvidenceResult> {
  const normalizedOccurredAt = input.eventOccurredAt ? normalizeTimestamp(input.eventOccurredAt) : undefined;
  const transition: TransitionInput = {
    evidenceId: input.evidenceId,
    expectedPredecessorEventId: input.expectedPredecessorEventId,
    expectedPriorState: 'observed',
    newState: 'recorded',
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    eventOccurredAt: normalizedOccurredAt,
    reason: { code: 'receipt-validated', detail: null, sourceClaim: null },
  };
  return withTenantTransaction(pool, tenantId, async (client) => {
    const retried = await findRetriedTransition(client, tenantId, transition);
    if (retried) return retried;
    try {
      const record = await client.query<{ content_key: string; content_sha256: string; content_type: string; byte_size: number; twenty_workspace_id_reference: string; source_system: string; external_object_id: string; acquisition_mechanism: string }>(
        'select content_key, content_sha256, content_type, byte_size, twenty_workspace_id_reference, source_system, external_object_id, acquisition_mechanism from core.evidence_records where evidence_id = $1',
        [input.evidenceId],
      );
      if (record.rowCount !== 1) throw new CustodyValidationError('Evidence record is absent');
      const observation = record.rows[0]!;
      if (!observation.source_system || !observation.external_object_id || !observation.acquisition_mechanism) throw new CustodyValidationError('Evidence provenance is structurally invalid');
      const binding = await client.query('select 1 from core.workspace_bindings where tenant_id = $1 and twenty_workspace_id = $2', [tenantId, observation.twenty_workspace_id_reference]);
      if (binding.rowCount !== 1) throw new CustodyValidationError('Trusted tenant-to-Workspace binding is absent');
      await verifyReceipt(store, { contentKey: observation.content_key, contentSha256: observation.content_sha256, contentType: observation.content_type, byteSize: Number(observation.byte_size) });
    } catch (error) {
      if (!(error instanceof CustodyValidationError)) throw error;
      const detail = error instanceof Error ? error.message : 'Unknown custody validation failure';
      return appendTransition(client, tenantId, { ...transition, newState: 'invalidated', reason: { code: 'receipt-validation-failed', detail, sourceClaim: null } });
    }
    return appendTransition(client, tenantId, transition);
  });
}

export async function reconstructEvidence(client: PoolClient, evidenceId: string): Promise<{ record: Record<string, unknown>; events: Array<Record<string, unknown>>; head: Record<string, unknown> }> {
  const record = await client.query('select * from core.evidence_records where evidence_id = $1', [evidenceId]);
  const events = await client.query('select * from core.evidence_provenance_events where evidence_id = $1 order by lifecycle_sequence', [evidenceId]);
  const head = await client.query('select * from core.evidence_lifecycle_heads where evidence_id = $1', [evidenceId]);
  if (record.rowCount !== 1) throw new Error('Evidence record is absent');
  if (head.rowCount !== 1) throw new Error('Evidence lifecycle head is absent');
  return { record: record.rows[0] as Record<string, unknown>, events: events.rows as Array<Record<string, unknown>>, head: head.rows[0] as Record<string, unknown> };
}
