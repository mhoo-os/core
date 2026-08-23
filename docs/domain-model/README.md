# Domain model

Phase 0 defines no customer-facing domain model. Its only durable mapping is a
trusted Twenty Workspace ID to Core physical `tenant_id`, which creates neither
identity nor Workspace lifecycle authority. The local proof tables are listed in
[the Phase 0 foundation](../phase0-foundation.md).

Phase 0E defines the first bounded domain contract: an Evidence observation and
its append-only provenance ledger. Phase 0F persists and proves that contract
without extending Evidence into business facts, Entities, Events,
relationships, retrieval indexes, or agent conclusions. See
[the Phase 0F proof](../phase0f-evidence-lifecycle-proof.md).
