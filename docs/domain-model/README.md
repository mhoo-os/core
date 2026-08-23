# Domain model

Phase 0 defines no customer-facing domain model. Its only durable mapping is a
trusted Twenty Workspace ID to Core physical `tenant_id`, which creates neither
identity nor Workspace lifecycle authority. The local proof tables are listed in
[the Phase 0 foundation](../phase0-foundation.md).

Phase 0E proposes the first bounded domain contract: an Evidence observation
and its append-only provenance ledger. It is design-only, does not alter the
proof schema, and explicitly keeps Evidence separate from business facts,
Entities, Events, relationships, retrieval indexes, and agent conclusions. See
[the Phase 0E design](../phase0e-evidence-model-and-provenance-ledger.md).
