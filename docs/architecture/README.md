# Mhoo Core architecture

Phase 0 implements only local tenant-isolation, evidence-store, vector, and
durable-job plumbing. The accepted worker runtime is pg-boss: same Core source
and image, separate API and worker processes, separate queue and tenant-data
pools, migration-role schema installation, and explicit transaction-local tenant
context. See [the Phase 0B runtime proof](../phase0b-job-runtime.md).

This does not transfer production authority or implement a Knowledge connector,
MCP retrieval, LlamaIndex, R2, production embeddings, or LangGraph.

The Phase 0C LlamaIndex.TS transformation-only evaluation is complete and
recommends rejection; its isolated adapter is review evidence, not an adopted
Core dependency. See [the evaluation record](../phase0c-llamaindex-evaluation.md).
