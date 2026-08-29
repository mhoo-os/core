# Proposed Mhoo ADR-0007: Twenty-App Core runtime and hybrid primitives

- Status: **Proposed — unaccepted**
- Date: 2026-08-29
- Decision authority: `mhoo-os/mhoo`
- Draft custody: Core feasibility branch only

> This draft is not an accepted architecture decision. It does not amend or
> supersede any accepted ADR, authorize a Mhoo-Twenty upgrade, permit Core
> implementation work, or authorize deployment, migration, or cutover. It
> must be reviewed and accepted in `mhoo-os/mhoo` before it can govern.

## Context

Accepted Mhoo ADRs currently establish a standalone Core persistence and
execution boundary:

- Mhoo ADR-0003 requires Core tenant tables to use `tenant_id`, FORCE RLS, and
  transaction-local tenant context.
- Mhoo ADR-0004 selects PostgreSQL plus pg-boss for transactionally atomic
  domain mutation and bounded background dispatch.
- Mhoo ADR-0006 preserves Core ownership of tenant-scoped durable state,
  knowledge, evidence, provenance, retrieval structures, execution records,
  and model-output custody, while Twenty owns human and Workspace authority.
- Core ADR-0001 applies those decisions to the current Next/Drizzle/PostgreSQL
  foundation.

Those decisions define both durable authority and implementation constraints.
They do not establish that separate CRUD, API, UI, database, or queue plumbing
is intrinsically necessary for the Core domain.

The disposable feasibility study on
`codex/twenty-sdk-core-feasibility` tested an official Twenty SDK 2.37.0 App
against an exact Twenty v2.37.0 disposable runtime. It established that a clean
Core object model, relations, permissions, generated REST/GraphQL APIs,
HTTP-triggered functions, event and cron triggers, paginated ingestion,
idempotent recovery, lifecycle hooks, and structured two-Workspace isolation
can be implemented with Twenty App primitives.

The study also established material gaps:

- the tested LOCAL logic-function driver inherited undeclared Twenty-server
  environment values;
- no explicit LOCAL child memory, CPU, or concurrency ceiling was evidenced;
- checkpoint mutation and successor enqueue were not one transaction;
- raw-artifact custody and vector/hybrid retrieval still require specialized
  external primitives;
- application-data migration rollback and durable execution-log retention were
  not established; and
- current Mhoo-Twenty is based on Twenty v2.30.1 and cannot install or compile
  the tested SDK 2.37.0 slice without a separately approved runtime upgrade.

The feasibility report therefore classifies the architecture as
**E. BLOCKED — SECURITY / TENANCY GAP**. Structured Workspace isolation passed;
execution isolation did not.

## Proposed decision

If and only if every acceptance gate in this draft is closed, implement the
durable Mhoo Core contract primarily as an official Twenty App, with narrow
external primitives for responsibilities Twenty cannot safely or durably own.

The conditional target is:

```text
Twenty Runtime
  identity / authentication / Workspace authority
  application roles and permissions
  @mhoo/core Twenty App
    domain objects and relations
    provenance and execution records
    generated REST and GraphQL APIs
    bounded HTTP, cron, and event logic

Specialized external primitives only
  content-addressed raw-artifact storage
  vector / hybrid retrieval
  narrow durable ingestion worker
  thin Mhoo MCP adapter
```

This is one Core product boundary, not a Twenty UI bolted onto a second
general-purpose Core product. The worker, storage, retrieval, and MCP adapter
must remain specialized adapters and must not grow a duplicate identity
system, Workspace authority, generalized CRUD database, or shadow domain API.

### Authority boundaries

The following boundaries do not change:

- Twenty remains the sole authority for human identity, authentication,
  sessions, membership, roles, human authorization, active Workspace
  selection, and Workspace lifecycle.
- Core remains the owner of the Mhoo domain meaning and contract for
  tenant-scoped durable state, knowledge, evidence, provenance, relationships,
  retrieval structures, execution records, and model-output custody, even when
  application-owned records are physically stored by Twenty.
- **Core does not reason.** Models and agents perform interpretation,
  reasoning, planning, synthesis, classification, and generation.
- Connectors own provider authorization, APIs, webhooks, cursors, retries, and
  provider semantics; external providers remain authoritative for provider
  facts.
- Infrastructure owns deployment, secret delivery, backup, recovery,
  monitoring, rollback, and cutover, without acquiring domain authority.
- A Workspace ID, record ID, host, origin, slug, token payload, or storage key
  is a selector or correlation value, not an authorization grant.

### Data and tenancy

Application-owned Core records may use Twenty's Workspace-scoped storage and
permissions only after the replacement isolation properties are proved. The
old Core `tenant_id`/FORCE-RLS implementation may then become obsolete, but its
threat model and negative tests remain acceptance requirements.

The replacement must prove at least:

- no cross-Workspace record, API, token, job, cache, file, search, log, or
  execution-context access;
- least-privilege application and machine roles;
- application-only write boundaries for protected Core objects;
- explicit authorization before Workspace selection or resource access;
- secret isolation between the Twenty server, Apps, Workspaces, and workers;
  and
- explicit memory, CPU, time, and concurrency limits for App execution.

Twenty authorization and the retired Core FORCE-RLS model must not be described
as equivalent by assumption. The replacement is acceptable only when its
actual guarantees satisfy the required property or the difference is recorded
and approved.

### Core records and APIs

The Twenty App owns clean Mhoo objects such as sources, connections, sync runs,
documents, revisions, evidence, provenance, relationships, execution records,
projects/scopes, and model-artifact custody. It must not depend on stock CRM
People, Companies, Opportunities, or pipelines unless a separately reviewed
technical requirement establishes that dependency.

Generated Twenty REST and GraphQL APIs are the primary ordinary-record API.
Custom HTTP functions implement narrow validated commands. External machine
clients use explicit Workspace-scoped credentials and roles. The canonical
Mhoo MCP surface becomes a thin adapter over application services and generated
APIs; MCP remains transport rather than domain authority.

If later evidence shows that a required public contract cannot be expressed
without a second generalized Core API or database, implementation must stop
and this decision must be reconsidered.

### Ingestion and durable execution

Twenty functions may perform bounded synchronous commands, event handling,
cron sweeps, and replay-safe page work after the execution-isolation gate is
closed. They must not be treated as proof of atomic multi-stage continuation.

A narrow worker remains responsible for provider polling, long backfills,
bounded parallelism, durable continuation, and recovery where a record write
and successor enqueue cannot be committed atomically. Its work envelope must
retain trusted Workspace context, tenant-free domain payloads, deterministic
operation identities, idempotent writes, checkpoints, provenance, and
retry/recovery tests. Connector-owned provider logic remains outside the
worker's Core-domain responsibility.

The worker must use authorized Twenty APIs or narrowly reviewed application
functions. It must not introduce a shadow copy of ordinary Core records or a
second general-purpose application service.

### Raw artifacts and retrieval

Structured metadata, relations, permissions, object keys, hashes, byte counts,
content types, and provenance live in application-owned Core records.
Content-addressed raw or large bytes may live in an infrastructure-operated
object store such as R2. Object storage is not authoritative for domain meaning.

Vector embeddings, similarity search, and hybrid retrieval may use an external
specialized index. Candidate results must be filtered or re-authorized against
the authoritative Workspace and application permissions before return. The
embedding provider and model require a separate selection and provenance
contract; using embeddings does not make Core the reasoner.

### Versioning, lifecycle, and recovery

The App SDK/client and Twenty server compatibility range must be exact and
locked together. Moving current Mhoo-Twenty from v2.30.1 to a compatible
runtime is separate work with its own source, CI, immutable-artifact, runtime,
recovery, and cutover gates.

Before any migration, prove App install, upgrade, data transformation,
rollback, uninstall, backup, restore, and recovery for Core-owned records and
external references. No App lifecycle hook or green build alone establishes
recovery. There must be no silent dual writes between old and new Core storage.

The clean-bootstrap rule remains: no implicit import of legacy records,
credentials, provider tokens, artifacts, or configuration. Any migration must
have immutable source custody, an explicit mapping, reconciliation receipts,
rollback, and separately approved cutover.

## Acceptance gates

This draft cannot be accepted until all of the following are independently
evidenced and reviewed:

1. **Execution isolation:** the intended Twenty logic-function execution mode
   is run in a disposable environment and proves an explicit environment
   allowlist, secret isolation, bounded memory/CPU/concurrency/time, least
   privilege, and cross-Workspace negative cases.
2. **Runtime compatibility:** the intended Mhoo-Twenty source and immutable
   runtime install and execute the exact pinned App SDK/client release; an
   upgrade, if required, is reviewed separately.
3. **Tenant security:** record, relation, API, machine-token, file, search,
   cache, event, job, log, and operator isolation tests meet the accepted threat
   model without treating correlation as authorization.
4. **Evidence integrity:** application-owned evidence/provenance records prove
   protected writes, canonical identity, concurrency behavior, lifecycle,
   reconstruction, and timestamp integrity.
5. **Durable ingestion:** the narrow worker design proves crash recovery,
   checkpoints, idempotency, bounded parallelism, failure custody, and the
   exact handoff boundary where Twenty cannot provide atomic continuation.
6. **Retrieval authorization:** external full-text/vector candidates are
   re-authorized against Workspace and application policy before return.
7. **Lifecycle and recovery:** install, upgrade, data migration, rollback,
   backup, restore, and disaster-recovery receipts cover both Twenty records
   and external object/index state.
8. **Governance:** the final ADR is reviewed and accepted in `mhoo-os/mhoo`,
   with the system blueprint and repository-ownership map updated afterward.

Gate evidence must distinguish source, CI, immutable artifact, disposable
runtime behavior, persisted data, recovery, and production/cutover. Evidence at
one gate cannot authorize or prove a later gate.

## Consequences if accepted

- Stop building duplicate CRUD controllers, DTOs, forms, tables, admin UI,
  Workspace authorization plumbing, ordinary record APIs, and schema metadata
  machinery that Twenty safely supplies.
- Retain and port evidence identity, provenance, tenant-isolation threats,
  trusted job-envelope semantics, deterministic idempotency, recovery cases,
  storage receipts, retrieval evaluations, and security invariants.
- Retire the separate Core database, Drizzle tenant plumbing, FORCE-RLS
  implementation, Next API shell, and general pg-boss plumbing only after
  replacement proofs, migration, rollback, and cutover are accepted.
- Accept tighter coupling between Core domain delivery and the exact supported
  Twenty App/runtime contract.
- Keep object storage, retrieval, durable ingestion, and MCP small enough that
  they do not recreate the standalone Core application under new names.

## Current consequence while proposed

None of the conditional consequences above are operative. Current accepted
ADRs continue to govern. The existing standalone Core implementation remains
available as local proof evidence and should be frozen for architecture
expansion, not deleted or archived. Only bounded maintenance needed to keep its
current claims and proofs truthful is contemplated by this draft.

## Alternatives considered

### Continue the existing standalone Core

This preserves the strongest already-proved FORCE-RLS and transactional queue
properties but continues custom platform plumbing and duplicates capabilities
Twenty can provide.

### Use a pure Twenty App with no external worker or data primitives

This minimizes custom code but does not satisfy the evidenced atomic
continuation, raw-artifact, vector/hybrid retrieval, or execution-isolation
requirements.

### Twenty App plus narrow specialized primitives

This is the proposed conditional target because it minimizes generalized
custom application infrastructure while retaining specialized durability and
retrieval boundaries. It remains blocked by the acceptance gates above.

## Supersession if accepted

Acceptance would amend the implementation constraints in Mhoo ADR-0003,
Mhoo ADR-0004, Mhoo ADR-0006, and Core ADR-0001 where they require a separate
Core database, FORCE RLS, transaction-local `tenant_id`, pg-boss, or a
standalone Core API/worker boundary. It would not supersede their durable human
authority, authorization, provenance, isolation, clean-bootstrap, or
`Core does not reason` invariants.

Until an accepted Mhoo ADR records that supersession explicitly, there is no
supersession.

## Non-scope

- Accepting this draft or changing current architecture
- Upgrading or deploying Mhoo-Twenty
- Installing an App in production
- Provider calls, OAuth, credentials, or production data
- R2, embedding-provider, or vector-service selection or mutation
- Registry publication, image publication, DNS, traffic, Gate A, Gate B,
  Candidate 6, Phase 4, migration, or cutover action
- Deleting or archiving the current standalone Core implementation

## Evidence

- [`twenty-sdk-core-feasibility.md`](twenty-sdk-core-feasibility.md)
- [`architecture/twenty-app-core-target.html`](architecture/twenty-app-core-target.html)
- [`../twenty-app-spike/`](../twenty-app-spike/)

The evidence is disposable and branch-scoped. It is neither a release artifact
nor production authority.
