# Mhoo Core architecture

Phase 0 implements only local tenant-isolation, evidence-store, vector, and
durable-job plumbing. The accepted worker runtime is pg-boss: same Core source
and image, separate API and worker processes, separate queue and tenant-data
pools, migration-role schema installation, and explicit transaction-local tenant
context. See [the Phase 0B runtime proof](../phase0b-job-runtime.md).

This does not transfer production authority or implement a Knowledge connector,
MCP retrieval, LlamaIndex, R2, production embeddings, or LangGraph.

The Phase 0C LlamaIndex.TS transformation-only evaluation is complete and
recommends rejection. Its spike adapter and dependency were removed from the
final tree; the immutable evaluation commit is recorded in
[the evaluation record](../phase0c-llamaindex-evaluation.md).

Phase 0D separately passed a deterministic local-object-store proof with a
Mhoo-owned `EvidenceStore`, filesystem adapter, and loopback-only MinIO S3
adapter. It does not configure or prove Cloudflare R2; see
[the Phase 0D record](../phase0d-local-evidence-store.md).

Phase 0E is a design-only contract for evidence observation metadata and an
append-only provenance ledger. It permits no schema, lifecycle runtime,
connector, retrieval, embedding, MCP, agent, or workflow implementation; see
[the Phase 0E design](../phase0e-evidence-model-and-provenance-ledger.md).
