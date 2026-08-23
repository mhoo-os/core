# Core Phase 0 foundation

Phase 0 proves local Core isolation plumbing. It does not establish production
authority, a full Knowledge Plane, R2 compatibility, production embeddings, or
external provider access.

## Ownership

Twenty remains the human identity, membership, authorization, and Workspace
lifecycle authority. Core stores a trusted `twenty_workspace_id` to `tenant_id`
binding solely to isolate its data plane. A Core tenant is never an account or a
Workspace lifecycle entity.

Payload failed its identity-authority feasibility gate. The exact runtime result
is recorded in [Payload feasibility](payload-feasibility.md). Core Phase 0
therefore contains no Payload runtime, Admin, auth, GraphQL, or job path.

## Schema and roles

`db/migrations/0001_phase0_core.sql` creates the smallest proof schema:

- `workspace_bindings` is an unambiguous trusted mapping to a Twenty Workspace;
- `evidence_objects` and `phase0_embeddings` are tenant data-plane fixtures.

Every data-plane fixture table enables and forces RLS. Runtime code uses
`withTenantTransaction`, which applies `app.current_tenant_id` with
transaction-local `set_config`. `0002_phase0_runtime_role.sql` creates a
non-login least-privilege role; an environment-specific deployment mechanism
must grant it login credentials outside Git.

## Run the isolated proof

```bash
docker compose -f test/docker-compose.yml up -d --wait
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm phase0:proof
```

The proof uses a local Docker PostgreSQL+pgvector container bound to loopback.
It creates a random, in-memory runtime password and proof key, then proves:

1. one-connection `A -> no context -> B -> no context` RLS behavior;
2. the same isolation through a real HTTP route that resolves a trusted
   Workspace binding;
3. immutable-key behavior through `LocalFilesystemEvidenceStore`; and
4. deterministic 8-dimensional vectors, pgvector storage, and a
   tenant-scoped distance query.

The local filesystem store is intentionally a Phase-0 substitute:

```text
Local EvidenceStore PASS != R2 PASS
Deterministic local embedding PASS != production embedding selection or quality
```

`phase0:proof` may reset only the dedicated `mhoo_core_phase0` local test
database. It never contacts Cloudflare, GitHub, Twenty, or another provider.
The standalone worker proof is intentionally **UNPROVEN** because Payload Jobs
are not permitted after the feasibility failure.
