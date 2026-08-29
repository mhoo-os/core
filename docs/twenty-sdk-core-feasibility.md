# Hostile feasibility study: Mhoo Core as a Twenty App

Status: disposable architecture evidence; not an accepted architecture decision
Evidence date: 2026-08-29
Proof branch: `codex/twenty-sdk-core-feasibility`
Scope: local/disposable only; no production, provider, credential, deployment,
Gate A, Gate B, Candidate 6, or Phase 4 action

This report answers:

> Can `mhoo-os/core` implement the durable Mhoo Core contract primarily as a
> Twenty App built with the official Twenty SDK, while using external
> infrastructure primitives only where Twenty genuinely cannot satisfy the
> requirement?

The durable authority boundary is unchanged throughout this study: Twenty is
the sole authority for humans, authentication, membership, authorization, and
Workspace lifecycle; Core owns tenant-scoped Mhoo state, knowledge, evidence,
provenance, retrieval structures, bounded execution, and model-output custody;
Core does not reason; models and agents reason; connectors own provider
semantics.

## Evidence key

- **E1 — spike source:** `twenty-app-spike/` on this branch: three custom
  objects, six relation fields, three unique indexes, a restricted application
  role, HTTP/background/event/cron/lifecycle functions, generated clients, and
  unit/integration tests.
- **E2 — exact Twenty source/runtime:** lightweight Git tag `twenty/v2.37.0`,
  commit `6da524b8903ec16a3eeea4b2e4a5fb63dbfc1c58`, tree
  `3ce4ef3eac3604ee52b6b8ee0f1a4766d7f533ca`; disposable image
  `twentycrm/twenty-app-dev:v2.37.0` at
  `sha256:53381e68f6fa50808f624f4c0125ce2143c6d21321ba25886e1115c73367c6e6`.
- **E3 — same-runtime isolation receipt:** the same app installed into two
  disposable Workspaces on E2. Both ingests returned HTTP 200; the bounded
  document was absent in Workspace 2 before its own ingest and present after;
  a Workspace 1 key sent to the Workspace 2 host returned 403; the same
  deterministic document UUID existed independently in both Workspaces; both
  app installs were then removed.
- **E4 — LOCAL execution gate:** E2 source
  `packages/twenty-server/src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/services/local-child-process-runner.service.ts:166-172`
  removes only `NODE_OPTIONS`, then spreads the Twenty server's complete
  `process.env` into the child. The spike's boolean-only sentinel observed a
  task-specific parent value. No child `--max-old-space-size`, cgroup, or
  per-function concurrency cap was found; the disposable container reported
  Docker memory and CPU limits of zero (unconfigured).
- **E5 — Lambda alternative, source-only:** E2 has an AWS Lambda driver whose
  executor is set to 512 MB and 900 seconds in
  `lambda-driver.constant.ts`, and whose invocation payload supplies only the
  selected app/workspace environment. It requires AWS role/region
  infrastructure and was not executed because this task forbids credentials
  and external mutation. Production defaults logic execution to disabled.
- **E6 — ingestion runtime:** E2 docs/source cap a logic function at 900 seconds,
  `enqueueJobs` at 200 payloads/call, requested application retries at 3,
  delay at 7 days, app-install enqueue rate at 500/60 seconds, app-registration
  enqueue rate at 2,000/60 seconds, and Workspace function executions at
  1,000/60 seconds. The spike also proves that a checkpoint write and enqueue
  are not one transaction.
- **E7 — retrieval:** E2 provisions a PostgreSQL `TS_VECTOR` and GIN index for
  searchable custom objects, but the automatic custom-object side effect
  indexes only the searchable label identifier. The SDK exposes no app entity
  for additional search-field metadata. No embedding field, vector-similarity
  API, pgvector app contract, or hybrid retrieval primitive was found.
- **E8 — storage:** E2 supports `FILES`, signed URLs, local/S3-compatible
  server storage, 10 MB proxied uploads, and 1 GB direct uploads. The SDK
  `MetadataApiClient.uploadFile` accepts a complete `Buffer`; it is an
  attachment API, not a content-addressed raw-artifact custody contract.
- **E9 — permission/auth source:** E2 app roles support object, field, platform,
  and row-predicate permissions; application tokens are Workspace/application
  scoped; a user-triggered call is the intersection of user and app access;
  API keys can be role-bound; `MetadataWritability.APPLICATION` blocks
  non-application writes.
- **E10 — current-fork compatibility:** current Mhoo-Twenty is sourced from
  `twenty/v2.30.1`; checked-in SDK packages are 2.30.0. A strict SDK 2.37.0 app
  was rejected by a disposable fork-derived v2.30.1 runtime before install.
  A 2.30.0-pinned copy failed typechecking because the required app APIs do not
  exist in that SDK.
- **E11 — license custody:** exact npm tarballs and their distributed LICENSE
  files were hashed; E2 root license metadata and the Twenty Application
  Exception were inspected separately.
- **E12 — current Core:** current `origin/main` is a Next 16/Drizzle/PostgreSQL/
  pgvector/pg-boss local Phase 0 foundation. It is not NestJS and has no
  implemented provider ingestion, production retrieval, or MCP surface.
- **E13 — observability:** E2 can live-stream function logs to the CLI and emit
  execution events/application logs when an event-log sink is enabled. The
  CLI subscription is watcher-dependent; no app-owned durable execution
  history/retention contract was established.
- **E14 — lifecycle:** E2 supports metadata plan/apply, serialized Workspace
  metadata sync, pre/post-install and uninstall hooks, strictly increasing
  release versions, compatibility checks at deploy/install, auto-upgrade, and
  uninstall. It has no evidenced transactional application-data migration and
  rollback contract equivalent to a conventional schema migration system.

## 1. Primary classification

**E. BLOCKED — SECURITY / TENANCY GAP**

The framework fit is substantially better than the current amount of custom
platform plumbing: clean custom objects, relations, generated REST/GraphQL,
roles, HTTP functions, cron/events, background enqueue, tests, and lifecycle
all worked. Structured records also passed same-runtime two-Workspace
isolation. The decisive failure is execution isolation: the tested v2.37 LOCAL
driver gives app code undeclared Twenty-server environment values and provides
no evidenced per-child memory ceiling. A source-visible 512 MB Lambda option is
promising but unexecuted and adds AWS runtime authority. The pivot therefore
cannot be accepted until an allowed execution mode is proved secret-isolated,
memory-bounded, and operationally least-privilege.

If that blocker is closed, the smallest plausible architecture is Option C:
the Twenty App owns Core's domain/application/API layer, while content-addressed
raw storage, vector/hybrid retrieval, a narrow durable ingestion worker, and a
thin MCP adapter remain specialized primitives. No evidence justifies a second
general-purpose CRUD product.

## 2. Current repository custody

Fresh, non-sparse disposable checkouts were based on these exact
`origin/main` commits:

| Repository | `origin/main` | Open PRs observed on 2026-08-29 | Role in this study |
|---|---|---|---|
| `mhoo` | `d6c218bd5c996008398c7d03ac0af5350c382e08` | #14, #11 | Accepted cross-repository authority and ADRs |
| `core` | `93dfdae8463d280ad7f8bc1cc97eac6c680aec43` | #10 | Existing implementation and disposable spike |
| `mhoo-twenty` | `0a16a6d275011d21f83a86ee20cab280f9269810` | #23, #18, #12 | Current Twenty fork/source custody |
| `connectors` | `e0679a700cf771660b5c6265d6b9906814fca811` | none | Provider semantics boundary |
| `infrastructure` | `29815c29dea79f8b7bbd0723a209113f284d1af7` | #24 | Deployment/operations boundary |

Open-PR state is a point-in-time observation, not merge or architecture
authority. Accepted Mhoo ADRs and current Git source were kept distinct from
historical proof, this proposed design, disposable runtime behavior, and any
production claim.

## 3. Exact Twenty runtime and source tested

| Item | Exact identity | Result |
|---|---|---|
| Official source | `twenty/v2.37.0` -> commit `6da524b8903ec16a3eeea4b2e4a5fb63dbfc1c58`; lightweight tag | Source inspected |
| Official source tree | `3ce4ef3eac3604ee52b6b8ee0f1a4766d7f533ca` | Recorded |
| Disposable v2.37 runtime | `twentycrm/twenty-app-dev:v2.37.0`; image/digest `sha256:53381e68f6fa50808f624f4c0125ce2143c6d21321ba25886e1115c73367c6e6` | `appVersion=v2.37.0`, multi-Workspace enabled |
| Disposable current-fork-derived runtime | `mhoo/twenty-app-dev:v2.30.1`; image ID `sha256:1b93f05cac5927e479dc8492d78d815a5d86eaf3d15ca2b7ef49560c5b9de053` | Compatibility probe only |

The v2.30.1 image was built for this disposable app-dev probe. It is **not**
the exact Candidate 6 image, immutable candidate, or production runtime.

## 4. Exact SDK/client/CLI versions tested

| Package/tool | Version | Use |
|---|---:|---|
| `create-twenty-app` | `2.37.0` | Scaffolding/package and license custody |
| `twenty-sdk` | `2.37.0` | Manifest, CLI, functions, jobs, KV, roles |
| `twenty-client-sdk` | `2.37.0` | REST, metadata, and generated typed GraphQL clients |
| `twenty-ui` | `1.0.0-alpha.1` | Scaffold dependency; no UI required by spike |
| Yarn | `4.13.0` | Exact app package manager |
| Node contract | `^24.5.0` | SDK/app engine contract |
| Compatibility copy | SDK/client `2.30.0` | Current-runtime API-surface probe; failed typecheck |

`twenty-sdk` and `twenty-client-sdk` are exactly pinned together under
`devDependencies`, as the v2.37 SDK documentation requires.

## 5. License custody

### Exact published artifacts

| Published package | `package.json` license | Tarball SHA-256 | Distributed LICENSE SHA-256 |
|---|---|---|---|
| `twenty-sdk@2.37.0` | MIT | `0586358987d9aafb8c86f356532b4e70636a96e99e334e989189c69a726c6332` | `f2c3d261cefa7be3fe81790e777f72c83083b832e653c493db0cc960e81f2b0f` |
| `twenty-client-sdk@2.37.0` | MIT | `f66665c5cc8c06ae30f7d08d60d29854cb08500c486e6539e6fb42390ae6a1ac` | `f2c3d261cefa7be3fe81790e777f72c83083b832e653c493db0cc960e81f2b0f` |
| `create-twenty-app@2.37.0` | MIT | `43b6a0758da18905f9cb00db2d36cba2cbfdfc31dc323c64559280cbda3b28c5` | `f2c3d261cefa7be3fe81790e777f72c83083b832e653c493db0cc960e81f2b0f` |

The three tarballs each contain an MIT LICENSE and package metadata declaring
MIT. Their npm metadata omits a repository field; this is a metadata omission,
not a conflicting license declaration. The exact E2 monorepo packages also
declare MIT and have package-local MIT LICENSE files.

### Practical classification

1. **SDK packages:** published SDK/client/scaffolder artifacts are MIT by the
   exact metadata and distributed files inspected.
2. **Mhoo-authored app:** E2 root LICENSE defines a Twenty “Application” as code
   using published APIs, manifest/runtime/component interfaces without
   incorporating or modifying Twenty source, and says such an Application may
   use terms of its author's choice. This supports keeping Mhoo's app/domain
   source under Mhoo's chosen license when it remains on those interfaces.
3. **Twenty server/fork:** the repository is primarily AGPL-3.0, with named MIT
   packages and separately marked enterprise files. Operating/distributing the
   fork must be assessed under the server's actual applicable files and terms.
4. **Modified Twenty server:** the Application Exception explicitly says it
   does not apply to Twenty itself and that AGPLv3, including section 13,
   applies to a modified version.

This is source and artifact custody, not legal advice. No specific licensing
ambiguity observed in the exact SDK artifacts warrants classification G.

## 6. Current Core implementation inventory

The prompt's “standalone NestJS” premise is stale. E12 is a Next 16 local
foundation with one narrow probe route, Drizzle-over-`pg`, PostgreSQL/pgvector,
pg-boss, local/S3-compatible evidence-store adapters, and deterministic local
embeddings. It has no NestJS controllers and no production Core, provider
ingestion, R2, production embeddings, full retrieval plane, or MCP service.

Classification legend: **A** keep durable domain contract; **B** reimplement
with a Twenty App primitive; **C** retain as an external specialized primitive;
**D** delete/obsolete if the pivot is later accepted; **E** additional proof.

| Existing surface | Class | Hostile disposition |
|---|---:|---|
| Twenty Workspace -> tenant correlation rule | A | Preserve the “correlation is not authorization” rule; an app install may remove the numeric binding implementation, not the rule. |
| Tenant isolation threat model and negative tests | A | Preserve as acceptance cases; translate from `tenant_id` RLS tests to Workspace/schema/token and runner-isolation tests. |
| `FORCE RLS`, `NOBYPASSRLS`, transaction-local tenant context | D + A | Database implementation becomes obsolete under a Twenty-owned schema; its defense-in-depth properties remain a required comparison/acceptance contract. |
| `src/db/tenant-context.ts`, pool separation, Drizzle transaction helpers | D | Twenty owns Workspace routing and app clients if pivoted. Do not keep a shadow CRUD database. |
| Next 16 shell and `/api/phase0/probe` | D | Generated API and app HTTP functions replace the narrow application/API shell. |
| Drizzle CRUD/query plumbing | D | Generated REST/GraphQL and typed client replace it for ordinary records. |
| PostgreSQL migrations for Workspace binding/basic evidence fixtures | D | Re-express app-owned state as Twenty objects/relations/indexes only after an accepted ADR. |
| Evidence identity, observation, validation, lifecycle, and reconstruction contracts | A | These are Core domain knowledge, not database-framework choices. |
| `evidence_records`, append-only provenance events, lifecycle heads | B + E | Model as application-owned objects/relations only after proving immutable/write-boundary and concurrent no-fork behavior equivalent enough for the contract. |
| Evidence ledger service algorithms and canonical hashes | A + B | Reuse algorithms/tests; rewrite storage calls through application-authorized Twenty APIs. |
| Content-addressed `EvidenceStore` interface and receipt contract | A | Keep intact across native or external storage. |
| Local filesystem evidence adapter | D | Local proof fixture only. |
| S3-compatible evidence adapter | C | Potentially reusable for R2 from the narrow worker/app adapter; never make it a second generalized Core API. |
| Deterministic embedding provider and vector tests | A + D | Preserve evaluation cases and interface; discard the local fake as product implementation. |
| pgvector schema/query implementation | C + E | External vector/hybrid retrieval remains justified, but the exact engine/service requires later evidence rather than sunk-cost retention. |
| Trusted `MhooJobContext`, tenant-free payload, parser, idempotency keys | A | Preserve the envelope/provenance semantics in any Twenty job or external worker. |
| pg-boss queue, migrator, worker plumbing | D + C | Delete the current general plumbing if pivoted; keep only a narrow durable queue/worker if atomic continuation cannot be proved in Twenty. |
| Mock 100-item ingestion and failure injection | A | Retain as evaluation cases; replace implementation with the 1,000-item SDK fixture and future connector-owned fixtures. |
| Payload 3.88 feasibility probe | D | Retained historical evidence only; not runtime architecture. |
| Phase 0C LlamaIndex evaluation | A + E | Preserve findings/tests; no current production retrieval implementation exists to migrate. |
| MCP implementation | E | None exists. Prove a thin adapter against Twenty API/functions rather than preserving an absent service. |

Discarding these implementations would not discard the evidence/provenance,
isolation, idempotency, recovery, and evaluation knowledge they established.

## 7. Full capability matrix

Verdicts: **1** native Twenty App; **2** Twenty App plus small custom logic;
**3** Twenty App plus external primitive; **4** small external worker required;
**5** standalone Core service still required; **6** unsupported/blocked;
**7** unknown. No capability in this review produced evidence requiring a
second standalone general-purpose Core service (5).

### Identity and tenancy

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Twenty Workspace -> Core tenant correlation | `context.workspaceId`, Workspace-scoped install/token | none | 2 | E1 probe returns only execution Workspace; accepted rule still forbids treating an identifier as authorization. |
| Tenant isolation for structured state | Workspace schema selection and scoped tokens | none | 1 | E3 independently stored the same UUID in two Workspaces with no collision or read-through. |
| Human authorization | Twenty users, sessions, memberships, roles | none | 1 | E9; no Core identity system is introduced. |
| Machine/service authorization | Workspace API keys, application/delegated tokens, authenticated function routes | thin client policy | 2 | E1/E9; wrong-Workspace host/key returned 403. |
| App permissions | App role, object/field/row predicates, application writability | none | 1 | E1 default role is unassignable and limited to three app objects. |
| Cross-Workspace isolation, including execution | Record/schema isolation passes; LOCAL function child isolation fails | hardened runner or proved Lambda | 6 | E3 passes data; E4 exposes parent server environment and lacks an evidenced child resource ceiling. |

### Core state

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Sources | custom object | none | 1 | E1 `knowledgeSource`. |
| Connections | OAuth connection provider/connected account | connector semantics | 3 | E2 supports OAuth 2.0 only; connectors remain provider-behavior owner. |
| Systems/providers | custom object/fields/relations | connector catalog if needed | 2 | E2 clean custom model; no CRM object dependency. |
| Projects/scopes | custom objects and relations | none | 2 | Same primitives as E1; not separately spiked. |
| Documents | custom object | none | 1 | E1 `document`, generated APIs, unique logical key. |
| Source revisions | custom object or immutable revision fields | raw bytes in object store | 2 | E1 revision/provenance fields demonstrate the pattern. |
| Relationships | bidirectional relation fields/junction objects | none | 1 | E1 has six relation fields across three objects. |
| Sync runs | custom object | none | 1 | E1 durable cursor/status/counts. |
| Tombstones | `deletedAt` plus explicit tombstone object/fields | none | 2 | Base soft-delete exists; provider tombstone semantics remain Mhoo code. |
| Execution records | custom technical object | durable log sink optional | 2 | E13 platform stream is not the Core custody record. |
| Evidence | app-owned custom objects | raw evidence store | 3 | E12 contract plus E8 storage boundary. |
| Provenance | immutable IDs/hashes and relations | raw receipt store | 2 | E1 bounded provenance fields pass; full ledger concurrency remains a later proof. |
| Model-produced artifact custody | custom metadata/lineage records | content-addressed object storage | 3 | Core stores outputs but does not reason; E8. |

### Ingestion

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| HTTP webhook ingress | authenticated HTTP function or signature-verifying server-route resolver | none | 2 | E1 authenticated route; E2 forwards only declared headers and preserves raw body. |
| Provider polling | cron/background function | connector-owned worker | 4 | Provider semantics remain in `connectors`; long/retriable polling exceeds E6 bounded guarantees. |
| Cron sync | cron-triggered function | none for bounded sweep | 2 | E1 recovery cron receipt. |
| Incremental cursor sync | sync-run fields/KV | none for bounded pages | 2 | E1 cursor advances deterministically. |
| Pagination | generated API cursors plus page jobs | none | 2 | E1 traversed 1,001 records without repeated cursor. |
| Normalization | small logic function/domain module | none | 2 | E1 deterministic synthetic normalization. |
| Deduplication | unique indexes | none | 2 | E1 three unique indexes and logical-key count. |
| Idempotency | deterministic UUIDs/upsert/replay checks | none | 2 | E1 restart returned `already-completed`; final count unchanged. |
| Retry | `RetryableLogicFunctionError`, queue backoff/jitter | worker for broader policy | 2 | E6 caps application-requested retries at 3. |
| Failure recovery | retry plus cron repair sweep | worker for strict continuation | 4 | E1 recovers injected batch failure, but checkpoint/enqueue are not atomic. |
| Checkpoints | custom object/KV | none for bounded use | 2 | E1 cursor/processed count persisted. |
| Resumability | idempotent page function + repair cron | durable worker/queue | 4 | E1 proves bounded recovery; E6 leaves a crash window between checkpoint and enqueue. |
| Fan-out | `enqueueJobs` | worker above platform limits | 2 | E6 allows 200 payloads per call and applies enqueue limits. |
| Long backfills | segmented functions | durable worker/queue | 4 | Each run is <=900 seconds; no atomic multi-stage workflow transaction. |
| Parallel processing | worker queue | bounded-concurrency worker | 4 | E2 exposes rate limits but no app-level LOCAL child concurrency or resource control. |
| Database-triggered processing | object lifecycle event trigger | none | 1 | E1 source-created event receipt. |

### Knowledge and retrieval

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Documents | custom object | none | 1 | E1. |
| Chunks | custom object related to document | vector index for embeddings | 3 | Object modeling is native; vector work is E7 external. |
| Metadata | typed fields and `RAW_JSON` | none | 1 | E1 structured and JSON fields. |
| Full-text search | label-backed `TS_VECTOR`/GIN global search | external FTS or upstream multi-field SDK support | 3 | E7 indexes a custom object's label identifier, not document content. |
| Vector search | none in app contract | vector service/pgvector | 3 | E7 found no vector field/similarity SDK/API. |
| Embeddings | no Core-safe native app primitive | embedding service/model provider | 3 | E7; embeddings are retrieval structure production, not reasoning custody. |
| Hybrid retrieval | none | vector/FTS service plus app filters | 3 | E7. |
| ACL-aware retrieval | Twenty role/Workspace filters for records | external index filtered/rechecked through Twenty | 3 | External candidates must be authorized against E9 before return. |
| Provenance traversal | relations and generated queries | none | 2 | E1 relation graph proves base primitive. |
| Recent-source search | filters/sorts on date/source fields | none | 2 | Generated APIs support field filters; not load-tested. |
| Project/scope filtering | relations and role predicates | external vector filter | 3 | Structured filtering is native; hybrid vector filtering is external. |

### Storage

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Normal structured records | custom objects/fields | none | 1 | E1. |
| JSON/metadata | `RAW_JSON` | none | 1 | E1. |
| Large files | `FILES`/direct upload for ordinary attachments | content-addressed R2 | 3 | E8 direct cap is 1 GB, but logic upload is whole-Buffer and lacks Core custody semantics. |
| Raw MIME | file attachment | content-addressed R2 | 3 | Preserve bytes/hash/key outside ordinary records; E8. |
| PDFs | file attachment | content-addressed R2 | 3 | Same E8 boundary. |
| Images/video | file attachment | content-addressed R2 | 3 | Same E8 boundary; large streaming/retention not proved. |
| Git blobs | no Git-specific primitive | content-addressed R2 | 3 | Connectors own Git semantics; object records retain hash/key/provenance. |
| Object-storage references | text/hash/size/content-type fields | R2 | 3 | E1 stores deterministic references without external mutation. |

### Execution

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Short synchronous logic | HTTP/manual logic function | safe runner prerequisite | 6 | Function behavior passes, but E4 blocks the tested execution mode. |
| Durable background jobs | `enqueueJobs` | narrow worker for atomic continuation | 4 | E6 queue is durable enough for bounded jobs, not atomic with app record writes. |
| Delayed jobs | `delayMs` | none within 7 days | 1 | E6 range 0–604,800,000 ms. |
| Cron | cron trigger | none | 1 | E1. |
| Retries | queue retry plus typed retryable error | none for bounded policy | 2 | E6 requested retry 0–10, application retry capped at 3. |
| Multi-stage workflows | chained page jobs/records | narrow durable worker | 4 | E1 recovery works by replay/cron, not a shared transaction. |
| Long-running operations | split functions | narrow durable worker | 4 | E6 hard 900-second maximum. |
| Human approval | custom approval record/front component/command | none | 2 | Native records/UI can hold the gate; not spiked. |
| Callbacks | HTTP/server-route triggers | none | 2 | E2 supports authenticated routes and asynchronous cross-Workspace dispatch. |

### APIs

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Generated CRUD | generated object APIs | none | 1 | E1 REST reads and generated typed query. |
| REST | `/rest/<objects>` | none | 1 | E1. |
| GraphQL | generated workspace schema/client | none | 1 | E1. |
| Custom HTTP handlers | `/s/<route>` logic functions | none | 1 | E1. |
| Machine-to-machine usage | role-bound API keys/app tokens | client policy | 2 | E1/E9; application-owned objects deliberately reject external writes. |
| MCP adapter | no Mhoo domain adapter | thin MCP transport | 3 | Adapter should call Twenty APIs/functions; no large Core API is justified. |
| External agent/tool usage | Twenty API/functions | thin MCP adapter | 3 | Models/agents reason; Core app only retrieves/records/custodies outputs. |

### Operations

| Capability | Twenty primitive | External primitive | Verdict | Evidence |
|---|---|---|---:|---|
| Schema migrations | manifest plan/apply and serialized Workspace migration | none | 1 | E14; destructive changes are previewed/confirmed. |
| App migrations/upgrades | semver deploy/install, hooks, auto-upgrade | migration rehearsal/rollback runbook | 3 | E14 has lifecycle but no proved transactional app-data rollback. |
| Observability | execution events, optional event sink | durable metrics/log backend | 3 | E13. |
| Logs | live CLI stream, server logs | durable redacted log sink | 3 | E13 watcher-dependent CLI stream is not retention evidence. |
| Auditability | created/updated actor fields plus app execution/evidence objects | raw receipt store | 2 | Core must persist domain receipts rather than infer custody from logs. |
| Rate limits | server throttlers and 429 | backpressure in worker/client | 2 | E6 plus API defaults 100/sec, 100/60 sec and application-token 500/60 sec. |
| Secrets | app/server variables and OAuth connection store | hardened runner/secret broker | 6 | E4 lets LOCAL app code see undeclared server process environment. |
| OAuth connections | OAuth 2.0 connection providers | connector semantics | 3 | E2 currently supports OAuth only; provider behavior remains external owner. |
| Backup/recovery | Twenty database and configured file storage | infrastructure backup/recovery | 3 | App SDK has no independent backup authority; infrastructure owns operations. |
| Application packaging | build/tarball/npm marketplace | none | 1 | E14; app tarball upload cap 100 MB, dependencies 250 MB unpacked. |
| Testing | Vitest, programmatic lifecycle, ephemeral server action | none | 1 | E1 and E2; local config required a disposable-home guard. |
| Deployment | private deploy/marketplace/install primitives | infrastructure-owned promotion and rollback | 3 | E14 describes capability; this task performed no publish/deploy. |

## 8. Compatibility matrix

| Twenty runtime | SDK/client | Build | Install | Runtime | Verdict |
|---|---|---|---|---|---|
| Official app-dev `v2.37.0` (E2) | `2.37.0` / `2.37.0` | PASS, 25 files | PASS in both disposable Workspaces | PASS, all bounded tests | Exact tested slice is compatible |
| Fork-derived app-dev `v2.30.1` | strict `2.37.0` / `2.37.0`, `engines.twenty >=2.37.0 <2.38.0` | PASS through metadata planning | FAIL before sync | Not run | Server correctly rejected: requires `>=2.37.0 <2.38.0`, Workspace upgraded only to 2.30.0 |
| Fork-derived app-dev `v2.30.1` | downgraded `2.30.0` / `2.30.0` | FAIL typecheck | Not attempted | Not run | 2.30 lacks `runAs: 'application'`, `enqueueJobs`, `RetryableLogicFunctionError`, execution context, application writability, and configurable generated client APIs used by the slice |

Current Mhoo-Twenty custody is `.twenty-source` `v2.30.1`, upstream commit
`064bdd795a0bd78c65f024350cefed2c8f38a661`, upstream tree
`7ebc5efa7f5f1bfdf9d238a88e3455decaa4f313`, exact source commit
`5271f821d2adf6aa31c74b93d8166becc426fe0a`; the checked-in SDK/client are
2.30.0. The exact runtime upgrade required for the tested 2.37 slice is
Twenty 2.37.0. That is a separate, unapproved upgrade project; this study did
not upgrade Mhoo-Twenty or production.

## 9. Synthetic ingestion proof

`POST /s/ingest-fixture` accepts exactly one known fixture identifier. It
validates an exact one-key body, derives deterministic UUIDv4-compatible IDs,
upserts a source, creates a sync run, writes a related document, records source
URI/revision/content hash/raw-artifact key and hash, and completes the run. The
runtime proof then reads all three objects by generated REST and reads the
source by generated typed GraphQL.

The stress path creates 1,000 deterministic documents in pages of 100. It
injects exactly one retryable failure at cursor 200, persists a failure receipt,
retries, resumes, and completes with cursor and processed count 1,000. Together
with the single bounded fixture, the final paginated REST count is 1,001 and
the set of logical keys is also 1,001.

Result: **PASS for the bounded synthetic slice**, not a provider, throughput,
or production durability claim.

## 10. Restart, idempotency, and checkpoint result

- Restarting the completed stress fixture returned `already-completed` with the
  same deterministic run ID and cursor 1,000.
- The final record count remained 1,001; no duplicate logical key appeared.
- The injected failed page did not advance the cursor silently. Retry resumed
  from the persisted checkpoint.
- A database-created event and recovery-cron receipt were present before the
  assertion completed.
- The design is replay-safe but not atomic: a page can commit its records and
  cursor, then crash before enqueueing its successor. The recovery cron closes
  that bounded liveness gap eventually; it does not prove the same atomic
  continuation property as Core's existing PostgreSQL + pg-boss transaction.

Result: **PASS for deterministic restart/replay; FAIL as proof of atomic
multi-stage continuation**. The latter is why a narrow durable worker remains
in the conditional target.

## 11. Logic-function execution and application limits

| Limit/property | Exact v2.37 result | Architectural effect |
|---|---|---|
| Function timeout | default 300 seconds; accepted range 1–900 seconds | Split long work into replay-safe stages. |
| Timeout enforcement, LOCAL | parent sends `SIGKILL` after timeout | Hard time stop; cleanup must not depend on finally blocks. |
| Memory, LOCAL | no explicit child heap/cgroup/per-function cap found; disposable container memory limit unconfigured | **Blocker** for co-hosting app execution with Twenty server authority. |
| Memory, Lambda source path | 512 MB executor; 4 GB ephemeral storage; not runtime-tested | Candidate closure path, not current evidence. |
| Request JSON/urlencoded body | 10 MB server limit | Webhooks should carry references, not raw archives. |
| Text body | 1 MB | Same. |
| Logic response size | no explicit app response-size ceiling found in reviewed path | **Unknown**; do not return artifacts. |
| Function execution throttle | 1,000 executions / 60 seconds / Workspace | Bounded fan-out/backpressure required. |
| LOCAL child concurrency | no explicit app/child concurrency limit found | **Unknown/resource-risk**; external worker should own bounded parallelism. |
| `enqueueJobs` batch | at most 200 payloads/call | Page/fan-out design must batch. |
| App-install enqueue throttle | 500 jobs / 60 seconds | Bounds one installation. |
| App-registration enqueue throttle | 2,000 jobs / 60 seconds across Workspaces | Shared application backpressure. |
| Delay | 0–604,800,000 ms (7 days) | Native delayed work within range. |
| Requested retry | 0–10 queue attempts; app-requested retries capped at 3 | Idempotency remains mandatory. |
| Retry timing | exponential from 1 second with 0.5 jitter | Never depend on exact retry time. |
| Ordinary exception | permanent application failure | Throw the typed retryable error only for transient cases. |
| General API default | 100 requests/second and 100 requests/60 seconds | Client must honor 429/backoff; defaults can overlap. |
| Application-token API default | 500 requests/60 seconds across Workspaces | Shared app limit can couple tenants operationally. |
| Direct file upload | 1 GB | Suitable for ordinary direct-client attachments, not proof of raw custody. |
| Proxied upload | 10 MB | Logic functions should not proxy large bytes. |
| App tarball | 100 MB | Package application source separately from evidence. |
| Runtime dependencies | 250 MB unpacked | Keep SDK/client in dev dependencies and runtime tree narrow. |
| Function logs | live CLI subscription; optional event-log emission | Persist Core execution/evidence receipts explicitly. |

## 12. Workspace-isolation result

The same E1 app was installed in two Workspaces in one E2 server/database.
Both Workspaces ingested the bounded fixture. Before Workspace 2 ingested, its
Workspace-local probe returned `boundedDocumentPresent=false`; afterward it
returned true. Workspace 1's API key sent to the Workspace 2 host returned 403.
The same deterministic document UUID existed independently in both Workspace
schemas. Both installs were uninstalled.

This is strong behavioral evidence for ordinary app-record partitioning and
Workspace/token routing. It does **not** cure E4: the logic-function process in
either Workspace can see undeclared server-level environment variables in the
LOCAL driver. Record isolation passed; execution-secret isolation failed.

## 13. Generated API result

- Generated REST read source, sync run, document, and all 1,001 documents with
  cursor pagination.
- Generated `CoreApiClient` queried the custom source through GraphQL with
  compile-time field selection.
- An API key not assigned the application's unassignable default role was
  denied a typed `createKnowledgeSource` mutation because the object is
  `MetadataWritability.APPLICATION`.
- Application logic used `runAs: 'application'` for its own writes. A
  user-triggered default client would be narrowed to the intersection of the
  user's and application's permissions.

Result: generated Twenty APIs can be the primary structured Core API. They do
not replace raw object storage, vector/hybrid retrieval, or the thin MCP
transport.

## 14. HTTP-triggered logic result

The authenticated synthetic `POST /s/ingest-fixture` route passed. Invalid or
extra-shaped input is rejected by exact fixture validation; no URL, provider,
credential, or arbitrary payload can redirect it. The Workspace-probe and
boolean security sentinel are authenticated GET routes. The sentinel never
returns the value it detects.

E2 also supports unauthenticated provider-facing server routes with an owner-
Workspace resolver and asynchronous target dispatch, but its documentation
explicitly assigns signature verification to app code. Mhoo must verify raw
body/signature before dispatch and preserve connector ownership of provider
semantics.

## 15. Cron, event, and background result

- Database event: creation of the synthetic `knowledgeSource` produced a
  persisted proof receipt.
- Background: `start-stress-fixture` used `enqueueJobs`; each page ran in a
  fresh execution with its own timeout/retry context.
- Retry: a typed retryable error at cursor 200 was retried and recorded.
- Cron: a one-minute repair sweep observed/repaired recoverable run state and
  produced a persisted receipt.
- Lifecycle: pre-install, post-install, and uninstall hooks executed in the
  disposable lifecycle; the final test teardown removed the app.

Result: native triggers are credible for bounded work. They do not establish
atomic workflow continuation, exact-once event delivery, or long-backfill
resource isolation.

## 16. Large-artifact and storage result

Twenty can own an ordinary `FILES` field and can serve signed URLs over local
or S3-compatible storage. That is useful for human-facing attachments. It is
not sufficient evidence for the durable Core raw-artifact contract because:

- Core requires content identity (`sha256`), immutable key, MIME, byte length,
  source/revision provenance, verification receipt, retention, and recovery
  independent of a mutable record attachment.
- The logic-function SDK upload accepts a complete `Buffer`, while Core may
  ingest large MIME, PDFs, video, or Git blobs that should be streamed.
- Native direct upload can reach 1 GB, but the direct-client flow and signed URL
  do not by themselves establish content-addressed custody.
- App/runtime and raw bytes should not share one failure/restore domain by
  accident.

Conditional target: Twenty stores the document/evidence record, object key,
hash, MIME, byte length, source URI, and revision; R2 stores immutable raw
bytes; app/worker code verifies the receipt. E1 proves only the deterministic
references. It made no R2 or other external storage mutation.

## 17. Vector and retrieval result

Twenty v2.37 provides native keyword search for searchable objects using a
server-managed `TS_VECTOR` and GIN index. For a custom object, the automatic
side effect creates search metadata only for its label identifier. In E1 that
means document title, not the document `content` field. The public SDK does not
expose an entity to declare additional search fields. Search results are
permission-filtered structured records, which is useful but not a Knowledge
Plane.

No official v2.37 app primitive was found for embedding vectors, dimensions,
similarity queries, pgvector, chunk index management, or hybrid rank fusion.
Therefore:

```text
Twenty: document/chunk metadata, relations, Workspace permissions, provenance
External retrieval: embeddings, vector/FTS index, similarity/hybrid ranking
Core app logic: authorize/filter candidates, traverse provenance, return records
```

The external index must carry Workspace/project/source filters and every
result must be re-authorized against Twenty before disclosure. This is a
specialized retrieval primitive, not a second generalized Core database/API.

## 18. MCP and API architecture result

Generated REST/GraphQL and authenticated Core app functions are sufficient as
the primary machine API for structured state. The Mhoo MCP surface should be a
thin adapter that:

1. authenticates the external model/agent client;
2. resolves a trusted Workspace-scoped machine credential;
3. calls generated Twenty reads and explicit app functions;
4. calls the specialized retrieval primitive where needed;
5. returns provenance-bearing records; and
6. records model-produced artifacts when requested.

It must not become a second identity service, authorization engine, CRUD
platform, or reasoning runtime. ChatGPT, Claude, Codex, and other models/agents
reason; Core only retrieves, records, executes bounded deterministic work, and
custodies outputs.

## 19. Security comparison

| Property | Existing Core FORCE-RLS model | Twenty-App model | Change |
|---|---|---|---|
| Human identity/session/membership | Delegates to Twenty, then binds trusted Workspace to `tenant_id` | Native Twenty authority end-to-end | Improves: removes duplicate plumbing and translation risk. |
| Data partition | Every tenant row carries `tenant_id`; runtime roles are `NOBYPASSRLS`; PostgreSQL uses `FORCE RLS` and transaction-local context | Workspace-specific schema selected by authenticated Twenty context | Behavioral record isolation passed E3, but mechanism is not equivalent. |
| Independent DB enforcement | Query mistakes are contained by PostgreSQL RLS | Depends on Twenty schema selection, token guards, ORM, and operator correctness | Weakens defense in depth. |
| Human record permissions | Core would need its own mapped policy/API checks | Native object/field/row-predicate roles | Improves application ergonomics and consistency with human UI. |
| App write authority | Separate API/worker DB roles | `MetadataWritability.APPLICATION` plus an unassignable least-privilege app role | Comparable at API layer; E1 denial passed. |
| Machine credentials | Custom service auth still required | Workspace API keys and short-lived application/delegated tokens | Improves plumbing; still needs lifecycle/rotation policy. |
| Cross-Workspace API use | RLS tenant context rejects another tenant | Wrong host/key was 403; identical IDs isolated in schemas | Behavioral equivalence for tested API path. |
| Function secret isolation | Separate Core process can receive an explicit environment/secret set | LOCAL child inherits all Twenty server environment except `NODE_OPTIONS` | Material regression and hard blocker. |
| Function resource isolation | Independently containerized service can set memory/CPU/concurrency | LOCAL path has no evidenced child memory/concurrency cap; Lambda source sets 512 MB | Material regression until an allowed bounded driver is proved. |
| Queue/domain atomicity | Existing local proof sends pg-boss job in the same PostgreSQL transaction | App checkpoint write and enqueue are separate operations | Weaker; requires compensation or narrow worker. |
| Operator blast radius | Core database/runtime operator plus Twenty operator | Twenty operator/runtime controls identity, data, app secrets, functions, and backups | More concentrated; requires audited least privilege and recovery proof. |
| Provider credentials | Connector-owned boundary can be separately isolated | OAuth connections are user/Workspace scoped, but function runner consumes tokens | Ergonomics improve; runner and connector-semantics boundaries must be proved. |

What improves: one human authority, native Workspace membership/roles/UI,
generated API permissions, application-owned write protection, and less custom
auth/CRUD code. What remains behaviorally comparable: tested structured-record
separation and Workspace-bound machine access. What weakens: independent
database enforcement, execution secret/resource isolation, atomic queue
dispatch, and operator blast-radius separation. What becomes dependent on
Twenty: schema routing, token issuance, permission predicates, metadata
migrations, function isolation, backups, and recovery.

## 20. Existing Core components that become unnecessary

If and only if the pivot is accepted after the gates, stop building or remove:

- the Next/custom Core application shell and probe route;
- custom CRUD controllers/routes, DTOs, and duplicated REST/GraphQL plumbing;
- Drizzle metadata and ordinary source/document/sync CRUD repositories;
- a separate admin frontend, forms, tables, views, and Workspace membership UI;
- a second Workspace-to-tenant authorization layer;
- general job-status CRUD endpoints;
- current session/transaction tenant helpers used only for the shadow database;
- current pg-boss queue/migration/worker plumbing if the narrow external worker
  selects another durable queue;
- Payload runtime dependencies and the retained Payload feasibility probe;
- local fake embedding and filesystem storage as product components; and
- any proposed large custom Core API justified only as an MCP backend.

Do not delete these from current main while the result is blocked. This is a
conditional delete/migrate analysis, not authorization to discard evidence.

## 21. Existing Core concepts and contracts worth preserving

- “Core does not reason; models and agents reason.”
- Twenty's sole human/Workspace authority and “correlation is not
  authorization.”
- evidence identity, content hashes, immutable raw-artifact keys, and receipt
  verification;
- full source/revision/acquisition provenance;
- observed/recorded/superseded/retracted/invalidated lifecycle semantics;
- deterministic event IDs, idempotency conflict detection, and no-fork ledger
  tests;
- trusted async context, tenant-free domain payloads, and negative parsing
  tests;
- atomicity/replay/retry/checkpoint failure cases;
- least-privilege role and cross-tenant negative cases;
- content-addressed storage interface and recovery expectations;
- deterministic embedding/retrieval evaluation fixtures; and
- provider-free local proofs and clean-bootstrap/no-implicit-import boundary.

These should become framework-neutral domain/test packages where practical.

## 22. Minimum external infrastructure still required

Conditional on closing E4/E5:

1. **Content-addressed object storage** (expected R2): raw/large bytes,
   immutable keys, signed access, retention, and recovery.
2. **Vector/hybrid retrieval**: embeddings, chunks, similarity/FTS ranking, and
   filtered search. This may be pgvector or another evidence-backed service.
3. **A narrow durable ingestion worker/queue** for long backfills, bounded
   concurrency, provider polling, and atomic/repairable continuation. It is not
   a second CRUD/API product.
4. **A thin MCP adapter** for model/agent transport and machine auth.
5. **Operations-owned backup/log/metrics infrastructure** for Twenty data,
   raw objects, external index, and worker receipts.

If a sandboxed Twenty Lambda driver is chosen, its AWS account/role/layer
infrastructure is an additional Twenty runtime dependency and must be compared
against a hardened local runner or the narrow worker before acceptance.

## 23. Minimum custom code still required

- Mhoo object definitions, relations, indexes, app role, and lifecycle config;
- evidence/provenance/model-artifact contracts and validation;
- idempotent ingestion page handlers, checkpoint/recovery state, and worker
  protocol;
- connector-facing normalized event contracts (provider semantics stay in
  `connectors`);
- R2 content-addressed adapter and receipt verification;
- external retrieval index adapter plus Twenty authorization recheck;
- explicit machine-write HTTP commands rather than broad generated writes;
- thin MCP tools/resources mapping to those APIs/functions;
- domain execution/audit records and redacted observability; and
- integration, isolation, recovery, upgrade, backup, and restore tests.

No custom identity system, generic CRUD framework, admin frontend, or second
Workspace membership model is justified.

## 24. Twenty SDK gaps suitable for upstream contribution

| Gap | Class | Candidate contribution |
|---|---|---|
| No SDK entity for additional custom-object search fields | General SDK gap | `defineSearchField`/search-field manifest support with generated-client tests. |
| No checkpoint-and-enqueue atomic contract | General SDK/API gap | Durable continuation/outbox API or transaction-aware app job primitive. |
| Test config is tied to `os.homedir()/.twenty` | General SDK testing gap | Explicit config-directory/test-home option in programmatic CLI APIs. |
| No durable app execution-history query contract | General SDK gap | Typed, permissioned execution/log history API with retention metadata. |
| Whole-Buffer logic-function upload helper | General SDK gap | Streaming/direct-upload initiation and completion helpers for app logic. |
| No explicit upgrade/data-migration hooks and rollback receipt | General lifecycle gap | Versioned pre/post-upgrade hooks, dry-run plan, failure/rollback contract. |
| No app-level job priority or bounded concurrency setting | General background gap | Low-risk per-app concurrency/priority controls below platform ceilings. |
| v2.30 generated client lacks v2.37 configuration/run-as contracts | Version evolution | Maintain compatibility guidance and compile fixtures across supported server ranges. |

No upstream PR was opened.

## 25. Twenty platform gaps suitable for upstream contribution

| Gap | Class | Candidate platform work |
|---|---|---|
| LOCAL child inherits server parent environment | Platform security limit | Start from an empty allowlist plus declared app variables/tokens; add negative cross-app/server-secret tests. |
| LOCAL execution has no explicit memory/CPU/concurrency sandbox | Platform security/availability limit | Per-execution cgroup/container/sandbox or documented bounded runner; fail closed in production. |
| Shared application-token limit couples installs across Workspaces | Platform operations limit | Per-install fairness plus registration-wide ceiling/metrics. |
| No native vector/embedding/similarity app contract | Platform capability limit | Only if Twenty wants this generally; otherwise external specialization is cleaner. |
| Label-only automatic custom-object full-text surface | Platform/SDK gap | Multiple declared searchable fields with safe rebuild/migration behavior. |
| Function log stream is not a durable app audit contract | Platform observability limit | Persisted, scoped execution status/log metadata and export sink controls. |
| App metadata lifecycle lacks an evidenced data rollback model | Platform lifecycle limit | Atomic migration state, rollback/recovery receipts, and upgrade rehearsal API. |

The secret/resource isolation items are acceptance blockers, not optional
polish. Vector storage is likely better left external unless Twenty adopts a
general, permission-aware application contract.

## 26. Option A/B/C comparison

Scores are 1 (unfavorable) to 5 (favorable) for the durable Mhoo requirement,
not for preserving prior investment.

| Criterion | A: existing standalone Core | B: Twenty-App Core | C: Twenty App + thin specialized worker/data primitives |
|---|---:|---:|---:|
| Engineering effort | 2 | 4 | 3 |
| Code volume | 1 | 5 | 4 |
| Duplicated platform plumbing | 1 | 5 | 4 |
| API work | 2 | 5 | 4 |
| Auth work | 2 | 5 | 5 |
| UI work | 2 | 5 | 5 |
| Tenancy/security, current evidence | 5 | 1 | 3 |
| Ingestion durability | 5 | 2 | 5 |
| Retrieval capability | 4 | 2 | 5 |
| Operational complexity | 2 | 4 | 3 |
| Upgrade risk | 4 | 2 | 2 |
| Low Twenty coupling | 5 | 1 | 2 |
| Low vendor/framework lock-in | 4 | 2 | 2 |
| Upstream contribution opportunity | 2 | 5 | 4 |
| Testability | 4 | 4 | 4 |
| Maintainability | 2 | 4 | 4 |
| Time to useful Mhoo product | 2 | 5 | 4 |
| **Total / 85** | **49** | **61** | **63** |

Option A has the strongest already-proved database and queue isolation but the
most duplicated application plumbing. Option B minimizes code but is blocked
by execution security and remains weak for atomic ingestion/vector/raw bytes.
Option C is the smallest durable target **if** execution isolation is closed:
Twenty owns domain/application/API/UI plumbing; only specialized primitives
remain. The score is not an ADR or cutover authorization.

## 27. Recommended target architecture diagram

The conditional target is rendered as a validated, standalone interactive
diagram at [Twenty-App Core target architecture](architecture/twenty-app-core-target.html).
Its editable typed source is
`docs/architecture/twenty-app-core-target.json`. The diagram deliberately shows
the execution-isolation gate and labels the design conditional/unaccepted.

## 28. Recommended `mhoo-os/core` repository structure

Only after an accepted ADR and the blocking proof:

```text
core/
  package.json                     # pinned Twenty SDK app
  src/
    application-config.ts
    roles/
    objects/
    fields/
    indexes/
    logic-functions/               # short commands, cron/event adapters
    domain/
      evidence/
      provenance/
      ingestion/
      execution/
      retrieval/
    adapters/
      object-store/                # R2 keys/receipts; no generalized API
      retrieval/                   # vector/hybrid boundary
  worker/                          # only durable polling/backfill/continuation
    src/
  mcp/                             # thin transport adapter only
    src/
  tests/
    unit/
    integration/
    isolation/
    recovery/
    upgrade/
  docs/
    architecture/
    operations/
```

The app can remain a single repository/product even with these internal
specialized processes. Do not keep Next/NestJS/Drizzle/pg-boss merely to retain
a familiar shape. Package framework-neutral contracts where both app and
worker need them; do not let the worker acquire human authority or generalized
CRUD ownership.

## 29. ADR and documentation changes required

This is not merely repository-local. Accepted Mhoo ADRs currently require a
separate logical Core persistence boundary, FORCE RLS with transaction-local
tenant context, and pg-boss-based atomic dispatch. Hosting Core records and
execution inside Twenty changes cross-system tenancy, database ownership,
execution ownership, API boundary, app/runtime ownership, and recovery.

An explicitly unaccepted draft is included at
[proposed Mhoo ADR 0007](proposed-mhoo-adr-0007-twenty-app-core-runtime.md).
If the gates later pass, the change must be proposed in the `mhoo` coordination
repository, reviewed against ADR-0003/0004/0006, and accepted there before Core
implementation proceeds. Required follow-up documentation includes:

- repository ownership for the app, worker, MCP, object store, and retrieval;
- security model comparing Workspace schemas/roles with retired Core RLS;
- logic-runner isolation and secret lifecycle;
- app schema/data upgrade, rollback, backup, and recovery;
- connector-to-Core normalized contracts and OAuth custody;
- clean-bootstrap/migration plan with no implicit legacy import;
- immutable artifact and provenance migration verification;
- deployment promotion, rollback, and post-change validation; and
- an independently authorized production/cutover ADR or runbook.

The draft is not accepted, does not supersede current ADRs, and authorizes no
implementation or cutover.

## 30. Disposition of the existing standalone implementation

**Freeze architecture expansion; retain and partially reuse its contracts and
proof cases; do not archive or delete it while the result is blocked.**

Allow only bounded maintenance needed to keep current main truthful and its
local proofs reproducible. Do not add broad new CRUD/UI/API plumbing while the
execution gate is being resolved. If the new ADR is eventually accepted, move
domain algorithms/tests first, reproduce security/evidence/recovery gates on
the app/hybrid target, then archive obsolete implementation only after a
separate verified migration and rollback decision.

## 31. Proof branch and commit

- Branch: `codex/twenty-sdk-core-feasibility`
- Proof commit: `TO_BE_RECORDED_AFTER_FIRST_BOUNDED_COMMIT`
- Base: Core `origin/main` `93dfdae8463d280ad7f8bc1cc97eac6c680aec43`
- Merge status: intentionally unmerged

The branch is disposable architecture evidence, not a production or upgrade
input.

## 32. Tests executed and results

| Check | Result |
|---|---|
| `yarn typecheck` | PASS |
| `yarn lint` | PASS, 0 warnings/errors |
| `yarn test:unit` | PASS, 15/15 |
| `yarn build` | PASS, 25 files |
| Final full v2.37 install-to-uninstall lifecycle integration | PASS, 5/5 in 48.75 seconds |
| Same-runtime two-Workspace isolation | PASS for structured records/API routing; LOCAL execution-secret isolation FAIL |
| Strict SDK 2.37 app -> disposable v2.30.1 runtime | Expected compatibility rejection before install |
| SDK/client 2.30 compatibility copy | Expected typecheck failure for missing required v2.37 APIs |
| Archify showcase validation | PASS, 9/9 checks, 0 composition errors, 0 warnings |
| Diagram visual containment and review | PASS at 1440x900, 1600x1000, 1920x1080, and 2048x1320; light/dark captures reviewed after one focused correction |
| `git diff --check` | PASS in final branch validation |
| User Twenty config hashes | Preserved: `config.json` `8cff8f8221d43ab242f25413413039d5f609ad9bacdf30083f54604a97363037`; `config.test.json` `8662c1aaf76278e7d1fc37fd3cd33292cb07070cef3bd9661b814164615f8305` |

The integration lifecycle installed and uninstalled the app. No failed proof was
recast as success: the LOCAL sentinel's `true` result is adverse security
evidence.

## 33. No-production/no-provider confirmation

No production installation, deployment, DNS, provider call, OAuth flow,
credential inspection, production data access, image publication, registry
write, Gate A, Gate B, Phase 4 mutation, Candidate 6 mutation, production
migration, production database change, merge, or cutover occurred. All runtime
and Workspace mutations were confined to the two named disposable local Twenty
containers/volumes and synthetic fixtures. Raw secret values were not returned
or recorded. The user's existing `~/.twenty/config.json` and
`config.test.json` were protected by a redirected task-specific home and their
hashes were unchanged.

## 34. Direct recommendation

BLOCKED PENDING proof of secret-isolated and memory-bounded Twenty logic-function execution
