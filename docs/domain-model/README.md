# Domain model

Phase 0 defines no customer-facing domain model. Its only durable mapping is a
trusted Twenty Workspace ID to Core physical `tenant_id`, which creates neither
identity nor Workspace lifecycle authority. The local proof tables are listed in
[the Phase 0 foundation](../phase0-foundation.md).

Phase 0E defines the first bounded domain contract: an Evidence observation and
its append-only provenance ledger. Phase 0F persists and proves that contract
without extending Evidence into business facts, Entities, Events,
relationships, retrieval indexes, or agent conclusions. It is the first proven
primitive, not the permanent Core conceptual center. The broader intended Core
shape is tenants/authorization, entities, records, relationships, knowledge,
files/objects, evidence/provenance, connector state, durable tasks, and query
and mutation contracts. See [the Phase 0F proof](../phase0f-evidence-lifecycle-proof.md).
