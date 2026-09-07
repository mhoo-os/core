<!-- mhoo-os-context:start -->
### Mhoo Core Legacy Evidence: Mhoo OS context

This repository is the preserved source and bounded proof record for the superseded separate-Core implementation.

- **Owns:** the exact legacy Core source; local isolation and job proofs; historical evidence and provenance records pending an explicit archival or extraction decision.
- **Does not own:** new target behavior or the @mhoo/core App; human identity or Workspace lifecycle; provider semantics; deployment or cutover authority.
- **Architecture authority:** [accepted Mhoo OS blueprint](https://github.com/mhoo-os/mhoo/blob/92e43a7b9a59570c76729fb5f8850c66bda6ef78/docs/architecture/SYSTEM_BLUEPRINT.md) and [ADR-0008](https://github.com/mhoo-os/mhoo/blob/92e43a7b9a59570c76729fb5f8850c66bda6ef78/ADR/0008-twenty-framework-platform.md).
- **Current implementation evidence:** [repository-owned source and records](https://github.com/mhoo-os/core/tree/main/docs).
- **Deployment and production evidence:** owned separately by [Mhoo OS Infrastructure](https://github.com/mhoo-os/infrastructure/tree/main/docs); source, CI, publication, and rehearsal are not deployment or cutover proof.
- **Upstream context:** Mhoo-native legacy proof repository; ADR-0008 assigns @mhoo/core work to mhoo-twenty; ADR-0009 assigns Finance to mhoo-twenty-next and authorizes no source or data deletion.
- **Contributors:** start with the [repository instructions](https://github.com/mhoo-os/core/blob/main/AGENTS.md). Generated context is governed by [README governance](https://github.com/mhoo-os/mhoo/blob/main/docs/architecture/README_GOVERNANCE.md).
<!-- mhoo-os-context:end -->

# Mhoo Core

[![Status: Phase 0](https://img.shields.io/badge/status-phase_0-2563eb)](https://github.com/mhoo-os/core)
[![Authority: none](https://img.shields.io/badge/production_authority-none-64748b)](https://github.com/mhoo-os/core)

This repository contains the superseded separate-Core implementation and its
bounded Phase 0 proof record. The source still implements tenant-scoped durable
state, evidence, provenance, retrieval experiments, and bounded execution for
that historical design; it is no longer Mhoo's advancing application or data
framework.

Twenty remains the authority for people, authentication, memberships,
authorization, and Workspace lifecycle. The Workspace-to-tenant binding below
is valid only inside the legacy proof boundary and is not part of the accepted
target.

Within this exact source, Core enforces tenant context; PostgreSQL supplies
transactions and RLS; pg-boss supplies atomic dispatch and bounded background
tasks. Core does not reason. These implementation facts remain evidence, not
permission to advance or deploy the separate service.
The detailed boundary and future-only Inngest tripwires are in
[ADR-0001](ADR/0001-execution-architecture.md).

See [Phase 0 foundation](docs/phase0-foundation.md) for the local proof and its
limits.

## Accepted target disposition

[Mhoo ADR-0008](https://github.com/mhoo-os/mhoo/blob/0e94e6b00a3033215e4df3ab197e5559652c2436/ADR/0008-twenty-framework-platform.md)
replaces the separate-Core target with a foundational `@mhoo/core` Twenty App
owned in `mhoo-twenty`. This repository preserves its exact source and proof
records as bounded evidence; it receives no new target behavior.

See the [transition note](docs/twenty-framework-transition.md) for the accepted
disposition, preservation rules, and remaining implementation gates. Nothing
in ADR-0008 moves code or data, deletes this repository, or authorizes the App
scaffold, deployment, cutover, or destructive retirement.

## Current local boundary

Current source proves local tenant isolation, filesystem and loopback S3
evidence-store behavior, deterministic local vector behavior, a provider-free
pg-boss job path, and an append-only evidence lifecycle ledger. These proofs do
not establish production deployment, complete ingestion or retrieval, hosted
embeddings, provider access, or a production Knowledge Plane.

[Phase 0B](docs/phase0b-job-runtime.md) selected pg-boss as the Core durable-job
substrate after transactional enqueue, recovery, RLS, privilege, and connection
proofs. It is not an ingestion implementation or a workflow-engine mandate.

[Phase 0C](docs/phase0c-llamaindex-evaluation.md) evaluated LlamaIndex.TS as a
transformation-only dependency and recommends rejection before real ingestion.

[Phase 0D](docs/phase0d-local-evidence-store.md) proves a tiny Mhoo-owned,
immutable EvidenceStore contract against local filesystem and loopback-only
MinIO. It does not select or configure Cloudflare R2.

[Phase 0E](docs/phase0e-evidence-model-and-provenance-ledger.md) defines the
accepted Evidence identity, provenance, and lifecycle-ledger contract.
[Phase 0F](docs/phase0f-evidence-lifecycle-proof.md) proves its narrow
tenant-RLS schema, immutable observations, and append-only lifecycle ledger;
it does not implement ingestion, retrieval, embeddings, MCP, agents, or a
workflow engine.

[Payload feasibility](docs/payload-feasibility.md) records why Payload is not
used as Core runtime infrastructure.

## Contributor entrypoint

Read [AGENTS.md](AGENTS.md) before work. This repository owns preservation of
its exact legacy implementation and proofs; advancing `@mhoo/core` work belongs
to `mhoo-twenty`. The package name in `package.json` does not change that boundary.

Before probes, reuse the assigned issue/PR run ledger and coordinator checkpoint.
On the current desk these are routed through
`/Users/mhoooo/Documents/Codex/MHOO-DESK-SETUP.md` and
`/Users/mhoooo/Documents/Codex/2026-09-06/mhoo-coordinator/checkpoint.json`.
These are local coordination pointers, not portable repository dependencies.
If unavailable, request the retained coordinator's existing receipt. Do not
create a replacement ledger or infer that workers have stopped.

Historical anchors include [Phase 0F PR #8](https://github.com/mhoo-os/core/pull/8)
and [trusted async context PR #9](https://github.com/mhoo-os/core/pull/9), together
with the Phase 0 documents above. Their merged source is evidence for the stated
local scope, not a fresh test result. Adjacent
[MHO-249](https://linear.app/mhoo/issue/MHO-249) concerns legacy-host retirement;
it does not authorize archival or extraction of this repository. The bounded
desk setup has no assigned Core feature issue; do not invent one.

### Existing validation commands

Commands below come from [package.json](package.json) and
[Core validation CI](.github/workflows/ci.yml). The package pins pnpm 10.32.1,
requires Node >=20.9.0, and CI selects Node 22.

| Purpose | Existing command |
| --- | --- |
| Locked dependency install | `pnpm install --frozen-lockfile` |
| Unit tests | `pnpm test` |
| TypeScript checks | `pnpm typecheck` (`pnpm lint` runs the same `tsc --noEmit`) |
| Next application build | `pnpm build` |
| Foundation / jobs / storage / lifecycle proofs | `pnpm phase0:proof`, `pnpm phase0b:proof`, `pnpm phase0d:proof`, `pnpm phase0f:proof` |
| Isolated migrator validation | `pnpm db:migrate` with the CI test-database configuration |
| Retained Payload feasibility probe | `pnpm payload:feasibility` (not a runtime validation gate) |

CI starts its dedicated services with
`docker compose -f test/docker-compose.yml up -d --wait`. Proofs and migration
commands can change that test database; confirm exclusive disposable ownership
and read the owning proof document before running them. CI's final
`docker compose -f test/docker-compose.yml down -v` removes its test volumes;
do not apply that cleanup to an unknown or shared environment.

For documentation-only work, verify links, command/config agreement, diff
whitespace, and unchanged generated context, and document why local runtime
suites were not repeated. Runtime/source changes remain subject to AGENTS.md
and the existing CI gates. Reassess earlier receipts when relevant source,
dependencies, fixtures, configuration, environment, or authority changes.
Report review and CI status for the exact proposed head; neither grants merge,
deployment, extraction, or retirement authority.
