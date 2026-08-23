# Phase 0E: evidence model and provenance ledger design

- Status: Proposed design; no runtime or schema implementation
- Purpose: define the minimum custody contract that can sit above the immutable
  content-addressed object proved in Phase 0D

Evidence is an immutable supporting artifact and observation. It is not a
business fact, an Entity, an Event, a relationship, a retrieval record, or an
agent conclusion. Later facts and conclusions may reference one or more
Evidence records, but they do not become true merely because an Evidence record
exists.

## Boundary

Phase 0D owns the invariant that bytes live under their canonical immutable
content address. Phase 0E adds no storage adapter and does not change that
invariant. It defines the metadata and append-only provenance records that make
an observed artifact traceable later.

Twenty remains the authority for users, authentication, memberships,
authorization, and Workspace lifecycle. An Evidence record belongs to a Core
`tenant_id` that is bound to a trusted Twenty Workspace. This is physical data
isolation, not a second authorization system. The content-address key is never
an authorization capability and must not be exposed as one.

External systems remain authoritative for their own facts. Core records a
frozen observation of what it acquired, where it came from, and what later
happened to that observation. A provider changing or deleting its source does
not rewrite Core custody history.

## 1. Evidence identity and immutable observation metadata

`evidence_id` is a Core-generated immutable identifier. It is not derived from
content bytes, a provider identifier, or a URI: the same bytes may be observed
independently by different tenants or at different times. Phase 0F should use a
time-sortable UUID and a stable creation idempotency key, so a retried
observation command returns the original Evidence record rather than creating a
duplicate observation.

The initial immutable observation snapshot must contain at least:

```text
evidence_id
tenant_id
trusted_twenty_workspace_id_reference

content_key                         # exactly sha256/<digest>
content_sha256                      # must agree with content_key
content_type
byte_size

source_system                       # durable namespaced system name
source_instance_reference           # account/repository/tenant scope where needed
external_object_id                  # stable identifier in that source
source_revision                     # optional provider revision/version/commit
original_reference_uri              # optional locator; never byte authority

acquisition_mechanism               # connector/import/process identifier
acquired_at                         # when Core acquired the bytes
observed_at                         # when the observation was made
source_created_at                   # optional source claim, never invented
source_updated_at                   # optional source claim, never invented

creation_idempotency_key
initial_provenance_event_id
```

`content_key`, `content_sha256`, content type, and byte size are an immutable
storage receipt. They must be checked against the Phase 0D object before the
observation is recorded. Source fields are an immutable snapshot of the claim
available at observation time. Missing source data stays explicitly absent or
unknown; Core must not substitute `now()` or a guessed URI for source facts.

The creation idempotency key is supplied by the observer from a stable external
delivery/receipt identifier or a Core command token. It is scoped by tenant and
acquisition mechanism. A second independent observation may reference the same
content address but has a new idempotency key and a distinct `evidence_id`.

## 2. Source provenance

Source provenance is an opaque, preserved locator tuple:

```text
(source_system, source_instance_reference, external_object_id, source_revision?)
```

It identifies what Core observed without asserting that Core owns that source.
`original_reference_uri` is supplementary context for operators or future
connectors; Core never treats it as canonical storage, immutable identity, or
proof of continued provider availability.

`acquisition_mechanism` identifies how Mhoo obtained the observation, such as a
versioned connector or bounded import process. It is provenance only: Phase 0E
does not introduce a connector registry, provider client, import runtime, or
GitHub implementation.

## 3. Lifecycle and retention boundary

The normal evidence lifecycle is:

```text
observed -> recorded -> superseded | retracted | invalidated
```

- **observed** — Core has an immutable object receipt and source snapshot, but
  the observation has not yet become a referenceable recorded artifact.
- **recorded** — integrity, tenant binding, and minimum provenance are present;
  later Core facts may cite this Evidence record.
- **superseded** — a later recorded Evidence record is the newer observation
  for the stated source relationship. Superseded does not mean false.
- **retracted** — the source or observer reports withdrawal; the event records
  who made that claim and why. The historical bytes and prior observation stay.
- **invalidated** — Core has a specific integrity, provenance, or processing
  reason not to rely on the record. This is not a claim to own the provider's
  fact.

Evidence bytes and their initial observation snapshot are never overwritten.
Current lifecycle state is a projection of the ordered provenance events, not a
mutable replacement for history. Every transition includes a prior state and a
new state, and `superseded` must link to the replacement `evidence_id`.

Logical retirement is therefore distinct from physical retention. Retraction,
invalidation, and supersession retain the observation. A future retention policy
may remove physical bytes only through an explicitly recorded retention event
that preserves the original content receipt, policy reason, and time. Phase 0E
defines neither retention periods nor physical deletion; it does not claim that
Phase 0D object storage has a deletion policy.

## 4. Append-only provenance ledger

Each lifecycle action appends a typed provenance event. The minimum event set is
`evidence.observed`, `evidence.recorded`, `evidence.superseded`,
`evidence.retracted`, and `evidence.invalidated`. A future physical-retention
event is a separate custody fact, not a rewrite or deletion of these events.

Every event must retain:

```text
provenance_event_id                 # deterministic SHA-256 identity
evidence_id
tenant_id
event_type

idempotency_key
event_occurred_at                   # source/process occurrence when known
recorded_at                          # Core append time

actor_kind                           # connector | importer | core_process | retention_policy
actor_reference
actor_version
execution_reference                  # optional job/run/delivery reference

prior_lifecycle_state
new_lifecycle_state

causation_event_id                   # optional prior ledger event
related_evidence_id                  # required for supersession; optional otherwise
external_cause_reference             # optional provider delivery/retraction reference
correlation_reference                # optional shared operation reference

provenance_snapshot_or_typed_reason
event_payload_sha256
```

The first `evidence.observed` event contains the full initial source and content
receipt snapshot. Later events retain the typed reason or source claim needed to
explain the transition; they do not mutate that initial event or silently
replace metadata.

The deterministic event identity is calculated from canonical, delimiter-safe
encoding of:

```text
"mhoo.evidence.provenance-event.v1"
tenant_id
evidence_id
event_type
actor_kind
actor_reference
idempotency_key
```

Wall-clock timestamps and retry attempt numbers are deliberately excluded from
that identity. A retry with the same identity returns the existing event; the
same identity with a different canonical event payload is an integrity conflict,
not an update. `event_payload_sha256` covers the immutable complete event body.

The ledger is append-only within Core's normal runtime boundary: Phase 0F must
disallow application updates/deletes and allow only controlled append paths.
This design does not claim cryptographic non-repudiation against a privileged
database operator or introduce a global blockchain/hash-chain system. The
custody requirement is reconstructability from Core's durable record rather
than application logs or mutable provider state.

An actor is the process responsible for a transition, not a new human identity
authority. If an upstream Twenty subject reference is retained later, it is an
opaque provenance annotation supplied by an already-authorized caller; Core does
not authenticate it or derive access rights from it.

## 5. Reconstruction contract

Given only an `evidence_id`, the Evidence record plus its tenant-scoped ledger
events must answer:

1. Which immutable bytes were observed, including their canonical content key,
   digest, media type, and size?
2. Which Core tenant and trusted Twenty Workspace reference scoped the
   observation?
3. Which external system/object/revision was observed, by which mechanism, and
   when were bytes acquired and recorded?
4. Which lifecycle transitions occurred, in order, with their responsible
   process, cause, and related replacement evidence where applicable?
5. What is the current lifecycle projection, and has a later retention action
   changed physical availability?

The answer must come from Core's immutable snapshot and append-only ledger. It
must not require an application log, a live provider query, a mutable URI, or a
derived Entity, relationship, retrieval index, or agent conclusion.

## Phase 0F implementation gate

Phase 0E passes only when a review can walk representative records and prove:

- the same blob observed by two tenants remains two tenant-scoped Evidence
  observations without making the object key an access grant;
- the same source object at two revisions produces distinct observations with
  preserved revision provenance;
- a retried observation or lifecycle command returns the same deterministic
  event and does not duplicate history;
- a body-and-metadata mismatch to the content address is rejected before an
  Evidence record is recorded;
- supersession, retraction, and invalidation append explanations without
  deleting bytes or erasing prior state; and
- all five reconstruction questions above can be answered from the proposed
  record and ledger alone.

Passing this design review permits a separate Phase 0F schema and lifecycle
implementation proposal. It does not authorize a database migration, runtime
ingestion, external connector, embeddings, retrieval, MCP surface, agents, or
workflow implementation.
