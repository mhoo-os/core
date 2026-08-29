# AGENTS.md

## Repository role

`core` contains the local Mhoo Core foundation and its isolation proofs. It is
not the authority for human identity, authentication, membership, or Twenty
Workspace lifecycle, and it is not yet a production Knowledge Plane.

## Sources of truth

- Current migrations, `src/`, tests, and `package.json` scripts establish what
  is implemented.
- The accepted cross-repository ADRs in `../mhoo/ADR/` govern identity,
  tenancy, Payload, and durable-job boundaries.
- `docs/phase0-foundation.md`, `docs/phase0b-job-runtime.md`, and
  `docs/payload-feasibility.md` explain the current proof scope; they do not
  establish production authority or provider integration.

## Identity and tenant isolation

- Accept a trusted Twenty Workspace-to-`tenant_id` binding only to physically
  isolate Core data. Never treat it as an authorization substitute.
- Every data-plane access must remain tenant-scoped. Preserve `tenant_id`,
  FORCE RLS, and policies based on transaction-local
  `app.current_tenant_id`.
- Use the tenant transaction helpers; do not add convenience queries that
  bypass RLS or use session-level tenant `SET` state.
- Runtime roles must remain least-privilege and `NOBYPASSRLS`. Migration,
  schema-change, RLS-disable, and superuser authority do not belong to API or
  worker runtime roles.
- Queue connections and tenant data transactions use separate pools. Business
  handlers must establish tenant context before reading or writing data.

## Current proof boundary

- The repository has local filesystem evidence storage, deterministic local
  vector behavior, HTTP isolation proof, and a provider-free pg-boss job proof.
  These are local proofs, not claims of production storage, embeddings,
  retrieval quality, GitHub ingestion, or external-provider access.
- Payload 3.88 remains a retained feasibility probe, not Core runtime
  infrastructure. Do not add Payload Admin, authentication, GraphQL auth, or
  Payload Jobs without a new reviewed architecture decision.
- Keep local test data and credentials confined to the isolated test setup;
  never import legacy data or credentials by default.

## Working and validation rules

- Do not manually edit a generated Mhoo context block. Run the central checker
  for context changes and keep local implementation prose tied to current Core
  source, tests, migrations, and proof records.
- Preserve migration order and prove upgrades with the dedicated isolated
  PostgreSQL/pgvector environment. New migrations must retain the tenant and
  role boundaries above.
- Validate the affected surface with `pnpm test`, `pnpm typecheck`, and
  `pnpm build`; run `pnpm phase0:proof` or `pnpm phase0b:proof` when changing
  their boundary. `pnpm payload:feasibility` is evidence only, not a runtime
  validation path.
- Architecture changes affecting identity, authority, tenancy, or Core's
  cross-repository contract require an ADR in `../mhoo/ADR/`. Provider calls,
  hosted services, production data, and credentials require explicit authorization.
