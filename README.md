# Mhoo Core

[![Status: Phase 0](https://img.shields.io/badge/status-phase_0-2563eb)](https://github.com/mhoo-os/core)
[![Authority: none](https://img.shields.io/badge/production_authority-none-64748b)](https://github.com/mhoo-os/core)

Mhoo Core is the future tenant-scoped business-state and knowledge substrate
for humans, applications, and agents. Evidence and provenance are important
primitives, not the center of every Core mutation. Phase 0 contains a
local-only foundation proof; it has no production authority and does not ingest
customer or provider data.

Twenty remains the authority for people, authentication, memberships,
authorization, and Workspace lifecycle. Core stores only a trusted Workspace to
physical tenant-isolation binding.

Core owns durable truth and enforces its trusted tenant context; PostgreSQL
owns transactions and RLS; pg-boss owns atomic dispatch and simple background
tasks. External models own reasoning, while Twenty and MCP are interfaces.
The detailed boundary and future-only Inngest tripwires are in
[ADR-0001](ADR/0001-execution-architecture.md).

See [Phase 0 foundation](docs/phase0-foundation.md) for the local proof and its
limits.

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
