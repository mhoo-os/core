# Phase 0C: LlamaIndex.TS transformation-only evaluation

- Evaluation commit: `8245589f01d970bd9730d60206a5686b59230e9f`
- Date: 2026-08-23
- LlamaIndex.TS: `llamaindex@0.12.1`
- Recommendation: **REJECT**

## Scope and boundary

This is a local, offline comparison only. It does not change the accepted Phase
0B PostgreSQL, Drizzle, pg-boss, RLS, role, or worker boundary. It has no
GitHub connector, live source, MCP, embedding, vector store, retrieval, R2,
index, persistence context, agent, workflow, schema migration, or job-runtime
change.

Both candidates accept a Mhoo-owned transform input and return only Mhoo-owned
`KnowledgeChunk` values. The canonical output owns tenant/document/revision,
source locator, ordinal, normalized content hash, capped breadcrumb, and a
SHA-256 ID derived from those application-owned inputs. LlamaIndex IDs and
types never cross `src/phase0c/llamaindex-transform.ts`.

Breadcrumbs use a deterministic whitespace-token approximation. Their ceiling
is `min(64, floor(targetChunkTokens * 0.15))`; the Phase 0C target of 160 gives
a 24-token maximum. The closest heading context is retained first when the
full heading path exceeds that cap.

## Fixtures and behavior

The executable suite exercises local fixtures for simple prose, six-level
headings, a long section, fenced code, and lists/tables/mixed Markdown.

| Fixture | Native chunks | LlamaIndex chunks | Deterministic |
| --- | ---: | ---: | --- |
| simple prose | 1 | 1 | yes |
| deep headings | 6 | 6 | yes |
| long section | 2 | 2 | yes |
| code-heavy | 2 | 2 | yes |
| mixed Markdown | 3 | 3 | yes |

The native baseline is deliberately small: heading-stack extraction plus
paragraph-first splitting. LlamaIndex uses only `Document`,
`MarkdownNodeParser`, and `SentenceSplitter`, then immediately converts their
transient nodes to canonical chunks. Neither path persists data or invokes a
network/API provider.

## Results

```text
TRANSFORMATION-ONLY BOUNDARY: PASS
DETERMINISTIC OUTPUT: PASS
STABLE MHOO-OWNED IDS: PASS
METADATA PRESERVATION: PASS
BREADCRUMB CAP: PASS
MARKDOWN/CHUNK QUALITY: PASS
NO FRAMEWORK TYPE LEAKAGE: PASS
NO PERSISTENCE SIDE EFFECTS: PASS
OFFLINE EXECUTION: PASS
REMOVABILITY: PASS
COMPARATIVE VALUE: FAIL
ANTI-INNER-PLATFORM GATE: PASS
```

The test suite mechanically checks repeated canonical serialization, ordinal
ordering, source/tenant/document/revision preservation, ID/hash shape,
breadcrumb cap, difficult Markdown boundaries, offline execution with `fetch`
disabled, and that only the isolated adapter imports `llamaindex`.

## Dependency and decision

LlamaIndex functioned correctly within the narrow adapter, but it did not earn
its cost. Installing `llamaindex@0.12.1` added 35 packages and pulled in
`@llamaindex/workflow`; its `@llamaindex/workflow-core` dependency also reports
an unmet `next@^15.2.2` peer against Core's Next `16.2.6`. Mhoo must still own
the contract, IDs, metadata, breadcrumb policy, canonical hashing, and every
persistence boundary. The native baseline matched the evaluated fixture chunk
counts and required no new framework dependency.

Therefore LlamaIndex owns nothing in Core product code. The adapter, fixtures,
tests, evaluator, and pinned dependency are retained only in immutable
evaluation commit `8245589f01d970bd9730d60206a5686b59230e9f`; this closure
commit removes them from the final tree before any real ingestion work begins.
Phase 0C did not create a generic parser framework, pipeline DSL, provider
abstraction, workflow primitive, or plugin system.

## Reproduce

```bash
git show 8245589f01d970bd9730d60206a5686b59230e9f
```
