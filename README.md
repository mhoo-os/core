# Mhoo Core

[![Status: Phase 0](https://img.shields.io/badge/status-phase_0-2563eb)](https://github.com/mhoo-os/core)
[![Authority: none](https://img.shields.io/badge/production_authority-none-64748b)](https://github.com/mhoo-os/core)

Mhoo Core is the future canonical business-state and evidence layer. Phase 0
contains a local-only foundation proof; it has no production authority and does
not ingest customer or provider data.

Twenty remains the authority for people, authentication, memberships,
authorization, and Workspace lifecycle. Core stores only a trusted Workspace to
physical tenant-isolation binding.

See [Phase 0 foundation](docs/phase0-foundation.md) for the local proof and its
limits.

[Phase 0B](docs/phase0b-job-runtime.md) selected pg-boss as the Core durable-job
substrate after transactional enqueue, recovery, RLS, privilege, and connection
proofs. It is not an ingestion implementation or a workflow-engine mandate.

[Phase 0C](docs/phase0c-llamaindex-evaluation.md) evaluated LlamaIndex.TS as a
transformation-only dependency and recommends rejection before real ingestion.

[Payload feasibility](docs/payload-feasibility.md) records why Payload is not
used as Core runtime infrastructure.
