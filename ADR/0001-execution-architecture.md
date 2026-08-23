# ADR-0001: Core execution architecture and async tenancy

- Status: Accepted
- Date: 2026-08-24

## Context

Phase 0 needs a small, tenant-safe asynchronous execution boundary without
turning Core into a workflow engine. Twenty remains the authority for human
identity, membership, and Workspace lifecycle; that does not make Twenty the
center of Core architecture. Core must enforce the trusted tenant authorization
context it receives before accessing Core state.

## Decision

The execution doctrine is:

```text
Core        -> durable truth + authorized Core context
PostgreSQL  -> transactional consistency + tenant isolation
pg-boss     -> atomic dispatch + short-lived background tasks
Inngest     -> future durable orchestration, when justified
Models      -> reasoning and transformations
Twenty/MCP  -> interfaces, not architectural centers
```

Core is a tenant-scoped business-state and knowledge substrate for humans,
applications, and agents. Its durable scope includes tenant context, entities,
records, relationships, files/object references, knowledge, evidence and
provenance where applicable, connector state, lightweight operation status,
and durable business outcomes. Evidence is an important primitive; it is not
the organizing principle for every Core mutation.

Core does not own LLM reasoning, chart generation, finance analysis, prompt
orchestration, human-approval engines, durable workflow call stacks, multi-day
timers, generic saga state, or workflow coordination tables.

### Trusted async envelope

Every tenant-scoped job has a server-created envelope:

```ts
{
  context: {
    version: 1,
    tenantId,
    operationId?,
    actor: { type: 'user' | 'system' | 'service', id },
    requestId?,
    traceId?,
  },
  payload,
}
```

The producer resolves `tenantId` through trusted server-side authorization
before constructing the context. The domain payload is tenant-free. Worker
handlers receive `(context, payload)`, re-validate persisted envelope JSON,
and use only `context.tenantId` for RLS transactions. An object literal cannot
construct the branded TypeScript context; raw queue JSON is still validated at
the worker boundary because serialization removes TypeScript brands.

Each worker data operation uses a fresh transaction with transaction-local
tenant context:

```sql
BEGIN;
SELECT set_config('app.current_tenant_id', $1, true);
-- tenant work
COMMIT;
```

Session-level `SET` is prohibited. The API and worker runtime roles are
non-superuser and `NOBYPASSRLS`; Core tenant tables use forced RLS. The queue
polling pool never provides tenant data context.

Core does not configure PgBouncer in Phase 0. If a deployment introduces it,
the Core data pools must use **transaction pooling**, never session pooling.
This keeps the pooler aligned with the transaction-local RLS contract; the
`set_config(..., true)` setting is cleared by every commit or rollback. The
deployment setting is an Infrastructure verification item, not a reason to add
a speculative pooler to Core.

### pg-boss now

pg-boss is the current PostgreSQL-backed execution substrate. It owns
transactionally atomic queueing, bounded concurrency, short-lived retries,
crash recovery, and dead-letter handling. A Core domain mutation and its job
enqueue share one PostgreSQL transaction. No Redis queue, separate outbox,
Kafka, Temporal, or distributed transaction machinery is introduced.

An `operations` table is not needed in Phase 0 and is not added. If a future
capability needs one, it may contain only business-level lifecycle fields such
as `id`, `tenant_id`, `kind`, `status`, requester, timestamps, `result_ref`,
and `error_code`. It must not gain step/checkpoint/signal/resume/retry state.

### Inngest later, not now

Inngest is not installed or implemented. Reconsider it only when at least one
of these tripwires is reached:

1. durable waits measured in hours or days;
2. webhook or event correlation;
3. human approval followed by resume;
4. independently checkpointed/retried workflow steps; or
5. Core begins accumulating workflow tables or coordination-heavy state
   machines.

The future path is a pg-boss dispatcher that sends an idempotent external
event after Core records stable state. Its event identity must derive from
stable Core state such as `operation_id`, not a delivery attempt: Inngest may
receive an event even when its HTTP response is lost and pg-boss retries.
Delivery is therefore at-least-once, while one logical operation must remain
idempotent.

### Language principle

Core is **Postgres-first, monolith-first, language-pragmatic, and standards at
the boundary**. Phase 0 uses Node/TypeScript, Next, Drizzle, PostgreSQL,
pg-boss, S3-compatible object storage, Twenty for the human UI, and MCP as an
agent interface. Those boundary contracts must remain suitable for later Go,
Python, or Rust components where a demonstrated need exists; no rewrite is
authorized merely to show polyglot support.

## Consequences

- Phase 0 gains no schema migration or infrastructure dependency.
- Existing pg-boss proof coverage is extended to show trusted-envelope
  rejection, cross-tenant mismatch failure, connection reuse, retry safety,
  and transactional enqueue.
- A handler that attempts to read `payload.tenantId` fails type checking; the
  persisted-payload parser also rejects a `tenantId` field at runtime.
- Twenty continues to authorize humans before Core receives a request. Core
  enforces the resulting Core tenant context; it does not create a competing
  identity authority.
