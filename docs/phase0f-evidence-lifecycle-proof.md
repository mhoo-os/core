# Phase 0F: evidence schema and lifecycle proof

Phase 0F implements the narrow custody contract accepted in Phase 0E. It is
not an ingestion, retrieval, embedding, MCP, agent, connector, or workflow
implementation.

## Persisted boundary

Migration `0006_phase0f_evidence_ledger.sql` adds three tenant-RLS tables:

- `evidence_records` — the immutable observation snapshot and claimed Phase 0D
  receipt. It is custody evidence, not a statement that receipt validation has
  already passed.
- `evidence_provenance_events` — the append-only, ordered lifecycle ledger.
- `evidence_lifecycle_heads` — the mutable projection of the single current
  event and state; it is not historical authority.

All three tables have `FORCE ROW LEVEL SECURITY`. Runtime roles are not schema
owners and have no `BYPASSRLS`. Records and ledger events reject updates and
deletes in the database, including when a privileged migration connection is
used to try to mutate them. The lifecycle-head trigger requires each projection
to reference the matching Evidence, tenant, state, and sequence of its ledger
event.

The event insert trigger atomically locks and verifies the prior head. It
requires a strictly increasing sequence, the exact predecessor, the matching
prior state, and one of the legal Phase 0E transitions. A deferred constraint
then requires the new event to be projected to the head in the same transaction.
The `(evidence_id, predecessor_event_id)` uniqueness constraint is the durable
one-successor backstop. Timestamps are audit data only; they never choose the
lifecycle order.

## Runtime contract

`src/evidence/evidence-ledger.ts` is the only Phase 0F service surface.
`createObservedEvidence()` persists the observer's claimed canonical receipt
and immutable source snapshot without reading the object store. The explicit
`validateAndRecordEvidence()` boundary re-reads the Phase 0D `EvidenceStore`,
checks the canonical `sha256/<digest>` key, body digest, media type, and size,
rechecks the trusted Twenty Workspace-to-tenant binding and minimum provenance,
then appends `observed -> recorded`. A custody-validation failure instead
appends the only other legal successor, `observed -> invalidated`; the initial
observation remains durable. Direct generic `recorded` transitions are refused.
This creates no user, membership, or authorization authority.

Creation is serialized only by its declared identity:
`(tenant_id, acquisition_mechanism, creation_idempotency_key)`. A versioned
canonical creation-payload hash decides whether a retry returns the original
Evidence or fails as an integrity conflict. Ledger-event IDs and payload hashes
use the versioned, delimiter-safe and non-self-referential encodings specified
by Phase 0E. Every event payload hash includes the application-supplied Core
append timestamp (`recorded_at`) before the event is inserted. Timestamp inputs
are normalized to UTC before they are hashed and stored; transition reasons have
the fixed `code`, `detail`, and `sourceClaim` shape. Initial and later retries
recompute both deterministic event identity and the full canonical payload.
Supersession requires a distinct, same-tenant replacement whose lifecycle head
is `recorded`; other events may retain an optional related Evidence link. No
generic workflow state, scheduler, connector, or storage framework is
introduced.

## Proof

`pnpm phase0f:proof` creates a clean local Core schema and tests:

- concurrent identical creation: one immutable Evidence, all callers receive it;
- changed receipt or provenance under the same creation identity: integrity
  conflict;
- the same blob in two tenants and a later source revision: distinct,
  tenant-scoped observations;
- a claimed receipt persisting as `observed`, then explicit receipt/type/size
  validation to `recorded`, with forged bytes and metadata mismatches proving
  `observed -> invalidated` custody retention;
- initial and later idempotent retries, including changed initial actor and
  changed later execution-reference integrity rejection;
- canonical initial-event hash reconstruction showing that `recorded_at` is
  bound into `event_payload_sha256`;
- successful supersession to a same-tenant recorded replacement, plus rejection
  of absent, cross-tenant, and unrecorded replacements;
- a concurrent `superseded -> retracted|invalidated` race: exactly one successor
  (and an optional related Evidence link on retraction);
- runtime and database-level append-only enforcement, plus malformed
  lifecycle-head rejection;
- `A -> no context -> B -> no context` RLS isolation; and
- reconstruction proving all five Phase 0E questions from the immutable
  receipt, tenant/Workspace scope, source provenance, ordered events, and
  current head.

The proof uses only the local Phase 0D filesystem EvidenceStore and local
PostgreSQL test roles. It makes no external provider, Cloudflare R2, GitHub, or
production request.
