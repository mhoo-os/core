# Phase 0D: deterministic local evidence store

Phase 0D is a local storage-semantics proof, not an ingestion or cloud-storage
implementation. It establishes the smallest Mhoo-owned contract for immutable
evidence bytes before any Cloudflare R2 decision, source connector, embedding,
or retrieval work.

## Contract

`EvidenceStore` owns only `exists`, `get`, and immutable `put`. A caller uses
`putContentAddressedEvidence` to validate an evidence body, derive its canonical
key, and receive a small receipt:

```text
sha256(body) -> sha256/<64 lowercase hexadecimal characters>
```

Each object carries the exact bytes, content type, and SHA-256 metadata. The key
is authoritative: every read and write requires the exact canonical relation
`key == contentAddressedEvidenceKey(sha256(body))`. Reads recompute the digest;
a changed body, changed hash metadata, or coordinated body-and-metadata rewrite
under the old key is rejected. An identical second write returns `created: false`.

There is no tenant decision, authorization, evidence lineage model, generic
storage framework, or provider registry in this contract. Twenty remains the
authority for people, authentication, memberships, authorization, and Workspace
lifecycle; Phase 0D does not exercise those boundaries.

## Local adapters and proof

`LocalFilesystemEvidenceStore` publishes an object directory containing `body`
and `metadata.json` through a temporary directory plus atomic rename. It
validates an existing object after a publication race, so concurrent identical
writes reconcile without duplicate state.

`S3EvidenceStore` is the deliberately narrow S3/R2-compatible adapter. It uses
`HeadObject`, `GetObject`, and `PutObject`; immutable publication uses
`If-None-Match: *`. A `412` conditional-write conflict is compared byte-for-byte
and becomes an idempotent duplicate only when metadata, bytes, and content key
match. S3's transient `409 ConditionalRequestConflict` is retried as a bounded
conditional write before any result is accepted.

The executable proof runs the same contract against both adapters. Its S3 target
is a pinned MinIO container on `127.0.0.1:59000`, with local test-only
credentials. It creates a UUID-named test bucket, removes only its own objects
and bucket at completion, and creates no external resources.

```bash
docker compose -f test/docker-compose.yml up -d --wait
pnpm test
pnpm typecheck
pnpm build
pnpm phase0d:proof
```

The proof passed locally on 2026-08-24 with this matrix:

```text
DETERMINISTIC CONTENT ADDRESS: PASS
CONTENT-ADDRESS BINDING: PASS
BYTE-EXACT PUT/GET: PASS
IDEMPOTENT DUPLICATE WRITE: PASS
CONCURRENT DUPLICATE WRITE: PASS
INTEGRITY VERIFICATION: PASS
IMMUTABLE CONFLICT: PASS
LOCAL S3 COMPATIBILITY: PASS
EVIDENCESTORE SCOPE: PASS
```

## Explicit non-scope

This does **not** prove Cloudflare R2, production credentials, production bucket
policy, GitHub ingestion, transformations, embeddings, pgvector, FTS/RRF, MCP,
agents, a workflow engine, or Payload upload ownership. It introduces no remote
credentials and contacts no Cloudflare or GitHub service.

The existing Phase 0 local embedding fixture remains outside this proof and is
not a Phase 0D dependency or selection decision. The next approved phase must
remain separately bounded.
