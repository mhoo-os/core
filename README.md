<!-- mhoo-os-context:start -->
### Mhoo Core: Mhoo OS context

This repository is the tenant-scoped durable state, knowledge, evidence, provenance, relationship, retrieval, model-output-custody, and bounded execution substrate.

- **Owns:** tenant-scoped durable and derived state; knowledge and evidence custody; provenance and relationships; retrieval structures; bounded execution records.
- **Does not own:** human identity or Workspace lifecycle; provider semantics; model or agent reasoning; deployment authority.
- **Architecture authority:** [accepted Mhoo OS blueprint](https://github.com/mhoo-os/mhoo/blob/1374bbbe2a059320c29c8268ff971efbd9dfa256/docs/architecture/SYSTEM_BLUEPRINT.md) and [ADR-0006](https://github.com/mhoo-os/mhoo/blob/1374bbbe2a059320c29c8268ff971efbd9dfa256/ADR/0006-mhoo-os-system-architecture-blueprint.md).
- **Current implementation evidence:** [repository-owned source and records](https://github.com/mhoo-os/core/tree/main/docs).
- **Deployment and production evidence:** owned separately by [Mhoo OS Infrastructure](https://github.com/mhoo-os/infrastructure/tree/main/docs); source, CI, publication, and rehearsal are not deployment or cutover proof.
- **Upstream context:** Mhoo-native service repository; not an upstream product fork.
- **Contributors:** start with the [repository instructions](https://github.com/mhoo-os/core/blob/main/AGENTS.md). Generated context is governed by [README governance](https://github.com/mhoo-os/mhoo/blob/main/docs/architecture/README_GOVERNANCE.md).
<!-- mhoo-os-context:end -->

# Mhoo Core

[![Status: Phase 0](https://img.shields.io/badge/status-phase_0-2563eb)](https://github.com/mhoo-os/core)
[![Authority: none](https://img.shields.io/badge/production_authority-none-64748b)](https://github.com/mhoo-os/core)

Mhoo Core is the tenant-scoped durable state, knowledge, evidence, provenance,
relationship, retrieval, model-output-custody, and bounded execution substrate.
Evidence and provenance are important primitives, not the center of every Core
mutation.

Twenty remains the authority for people, authentication, memberships,
authorization, and Workspace lifecycle. Core stores only a trusted Workspace to
physical tenant-isolation binding.

Core owns tenant-scoped durable and derived state and enforces its trusted
tenant context; PostgreSQL supplies transactions and RLS; pg-boss supplies
atomic dispatch and bounded background tasks. Core does not reason. Models and
agents own interpretation and reasoning, while Twenty and MCP are interfaces.
The detailed boundary and future-only Inngest tripwires are in
[ADR-0001](ADR/0001-execution-architecture.md).

See [Phase 0 foundation](docs/phase0-foundation.md) for the local proof and its
limits.

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
