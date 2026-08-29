# Mhoo Core architecture

Phase 0 implements only local tenant-isolation, evidence-store, vector, and
durable-job plumbing. Core is a tenant-scoped business-state and knowledge
substrate, not an Evidence ledger with surrounding features. PostgreSQL owns
transactions and RLS; pg-boss owns atomic dispatch and simple background work;
models own reasoning; Twenty and MCP are interfaces. See
[ADR-0001](../../ADR/0001-execution-architecture.md).

The accepted worker runtime is pg-boss: same Core source and image, separate
API and worker processes, separate queue and tenant-data pools, migration-role
schema installation, a server-created job context, and explicit
transaction-local tenant context. See [the Phase 0B runtime proof](../phase0b-job-runtime.md).

This does not transfer production authority or implement a Knowledge connector,
MCP retrieval, LlamaIndex, R2, production embeddings, or LangGraph.

Accepted [Mhoo ADR-0008](https://github.com/mhoo-os/mhoo/blob/0e94e6b00a3033215e4df3ab197e5559652c2436/ADR/0008-twenty-framework-platform.md)
retains these results as historical, bounded proof while moving the advancing
`Core` product name to a deterministic Twenty App in `mhoo-twenty`. The App is
not implemented, and this repository is not future target architecture. See
the [transition note](../twenty-framework-transition.md).

The Phase 0C LlamaIndex.TS transformation-only evaluation is complete and
recommends rejection. Its spike adapter and dependency were removed from the
final tree; the immutable evaluation commit is recorded in
[the evaluation record](../phase0c-llamaindex-evaluation.md).

Phase 0D separately passed a deterministic local-object-store proof with a
Mhoo-owned `EvidenceStore`, filesystem adapter, and loopback-only MinIO S3
adapter. It does not configure or prove Cloudflare R2; see
[the Phase 0D record](../phase0d-local-evidence-store.md).

Phase 0E defines the evidence observation and append-only-ledger contract.
Phase 0F implements and proves only its tenant-RLS persistence, immutable
observations, deterministic idempotency, and atomic lifecycle transitions; see
[the Phase 0F proof](../phase0f-evidence-lifecycle-proof.md). It adds no
connector, retrieval, embedding, MCP, agent, or workflow implementation.
