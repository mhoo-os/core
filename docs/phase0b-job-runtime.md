# Phase 0B: pg-boss job-runtime proof

Phase 0B is a selection test, not Knowledge-product implementation. Its only
moving parts are PostgreSQL, Drizzle, FORCE RLS, pg-boss, separate API/worker
processes, and deterministic mock work. It has no GitHub connector, MCP,
LlamaIndex, embeddings provider, R2, retrieval, LangGraph, or external service.

The governing decision is [ADR-0004](https://github.com/mhoo-os/mhoo/blob/main/ADR/0004-core-pg-boss-job-runtime.md).
Payload's failed feasibility result remains unchanged in
[Payload feasibility](payload-feasibility.md).

## Runtime and roles

The same Core source/image has separate `api` and `worker` entrypoints:

```text
core-api: apiDataPool -> tenant transaction + transactional boss.send()

core-worker:
  bossPool       -> pg-boss polling, retry, expiry, dead-letter operations
  workerDataPool -> explicit tenant-scoped domain transactions
```

`core_migrator` alone installs/upgrades `pgboss` and creates queues. `core_api`
and `core_worker` are separate non-login role definitions that deployments give
login credentials; both are non-superuser and `NOBYPASSRLS`. Their experimentally
validated runtime grants are `USAGE` on schemas plus row DML only on the Core and
existing pg-boss tables. They cannot create schemas, alter protected Core tables,
disable RLS, bypass RLS, or assume migration authority.

Worker business operations always use:

```sql
BEGIN;
SET LOCAL app.current_tenant_id = 'tenant-id';
-- tenant reads and writes
COMMIT;
```

The queue pool never provides tenant context. `SET` is forbidden because pooled
connections could leak it; Core uses transaction-local `set_config` instead.

## Mock model and idempotency

One provider-free mock document produces 100 items. Each item has an independent
transaction and a revision-aware canonical key:

```text
hash(tenant_id + document_id + source_revision + transform_version + chunk_ordinal)
```

`content_hash` is stored separately from normalized content. A retry of the same
revision and transform version reconciles prior canonical rows; a new source
revision intentionally creates a new generation. Semantic chunk stability is
explicitly deferred to Phase 0C/Phase 1.

## Reproduce the proof

```bash
docker compose -f test/docker-compose.yml up -d --wait
pnpm install --frozen-lockfile
pnpm typecheck
pnpm phase0b:proof
```

The isolated command may reset only `mhoo_core_phase0`. It creates short test
expiration/heartbeat settings and performs a real hard process kill inside item
84's tenant transaction. It reports these required gates:

```text
PG-BOSS RUNTIME: PASS | FAIL
TRANSACTIONAL ENQUEUE: PASS | FAIL
LOGICAL RETRY: PASS | FAIL
WORKER CRASH RECOVERY: PASS | FAIL
TENANT RLS: PASS | FAIL
POOL HYGIENE: PASS | FAIL
LEAST PRIVILEGE: PASS | FAIL
DEAD-LETTER PATH: PASS | FAIL
ANTI-INNER-PLATFORM GATE: PASS | FAIL
```

The proof uses polling only. It records observed pool connections before any
future LISTEN/NOTIFY experiment; a listener is not enabled implicitly.

## Result

Phase 0B passed all critical gates on 2026-08-24. The implementation required
only pg-boss queues, a tenant transaction helper, idempotent repository writes,
and the domain-specific `ingestion_status`. It introduced no generic workflow
state, scheduler, checkpoint, fanout, dependency, join, or resume-token system.

Recommended initial budget: API data max 3; worker boss max 3; worker data max
3 for the proof workload (plus independently accounted migrator/test connections).
Production sizing remains a separate measured deployment decision.

For a non-destructive environment migration, run `pnpm db:migrate` only with
`CORE_MIGRATOR_DATABASE_URL`. Runtime startup always sets `migrate: false` and
fails if the installed pg-boss version does not match the package.
