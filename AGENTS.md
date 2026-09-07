# AGENTS.md

## Repository role

`core` preserves the superseded separate-Core implementation and its local
isolation proofs. Accepted Mhoo ADR-0008 assigns advancing `@mhoo/core` App
source to `mhoo-twenty`; this repository receives no new target behavior. It is
not human/Workspace authority or a production Knowledge Plane.

## Sources of truth

- Current migrations, `src/`, tests, and `package.json` scripts establish what
  is implemented.
- Accepted ADR-0008 and the current sources in `../mhoo/docs/architecture/`
  govern the target disposition. This repository's source and earlier ADRs
  govern only the exact legacy behavior they implement or prove.
- `docs/phase0-foundation.md`, `docs/phase0b-job-runtime.md`, and
  `docs/payload-feasibility.md` explain the current proof scope; they do not
  establish production authority or provider integration.

## Identity and tenant isolation

- Inside this legacy source, accept a trusted Twenty
  Workspace-to-`tenant_id` binding only to physically isolate Core data. Never
  treat it as an authorization substitute or copy it into the target merely to
  preserve the old design.
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
- These proofs justify preserving evidence, not advancing or deploying a
  separate Core API, worker, database, queue, object store, or MCP service.

## Working and validation rules

- Before any probe, read the assigned issue/PR run ledger and the existing
  coordinator checkpoint. Reuse accepted receipts; record the exact source
  commit, environment, result, remaining gate, and reason a new check is needed
  in that same ledger. Do not create a parallel status system or confuse this
  operational ledger with Core's historical evidence-ledger implementation.
- Verify origin, remote default branch, base/head, dirty state, and retained
  worktrees before editing. A missing local file is not evidence of remote
  absence. Work in an isolated branch; preserve other workers' changes.
- A receipt applies only to its recorded source and environment. Changes to
  relevant source, dependencies, configuration, proof fixtures, environment, or
  authority require reassessing its scope; unchanged accepted proofs need not
  be repeated merely to report activity. Never convert source/CI proof into
  runtime, recovery, or production acceptance.

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
- Do not implement new Mhoo product behavior here. A bounded extraction,
  archival action, data-retention decision, or destructive retirement requires
  its own reviewed plan and evidence; ADR-0008 does not authorize it by itself.

## Handoff and completion

Before continuation or handoff, record the primary issue (or explicitly none), implementation-owning repository, coordinating repo head and retained worker (or none), exact source commit and PR/evidence links, existing run-ledger location, dependencies/blockers and their owners (or explicitly none/unknown), and the authorized next step. Carry this mapping into the handoff and acknowledge the authoritative instructions commit and reading path. Resolve unknown or conflicting ownership with the owning head before dependent work; a project label or issue status does not grant authority or create a new task.

- Routing is user -> voice coordinator -> owning repo head -> assigned worker.
  Reuse the existing worker; custody transfers only after an explicit ACK and
  notification to retained workers. A repo-head assignment is not a feature
  dispatch. See the [README contributor entrypoint](README.md#contributor-entrypoint).
- Continue only the next authorized action that resolves a named remaining
  gate. Finish with exact base/head, files, PR, checks or justified omissions,
  evidence links, and retained-checkout availability in the existing ledger.
  A committed or proposed instruction change is not yet present in other
  workers' checkouts.
- Escalate conflicting ownership, missing decision evidence, or a required
  expansion of authority to the coordinator. Send requested catalog changes to
  the central owner rather than editing generated context. List cleanup
  candidates with custody and evidence; unknown or old does not mean disposable.
- Stop when the scoped receipt is delivered or the next gate requires a new
  decision. Do not invent an active issue, rerun unchanged proofs, merge,
  deploy, extract, or archive to keep this legacy repository busy.
