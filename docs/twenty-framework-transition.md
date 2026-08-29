# Accepted Twenty-framework disposition

- Status: `ACCEPTED ARCHITECTURE`; target App not implemented
- Governing decision: [Mhoo ADR-0008](https://github.com/mhoo-os/mhoo/blob/0e94e6b00a3033215e4df3ab197e5559652c2436/ADR/0008-twenty-framework-platform.md)
- Production and cutover: `NO-GO`

This note records the accepted target disposition for the `core` repository.
It does not start an extraction, authorize a Twenty App scaffold, move data,
delete source, retire a runtime, deploy, or cut over production.

## Current evidence boundary

The current tree implements and locally proves a separate Core foundation for
tenant-isolated PostgreSQL state, transaction-local RLS context, pg-boss jobs,
evidence and provenance records, local object-store adapters, and deterministic
evaluation behavior. Each proof retains the limit stated in its owning Phase 0
document. None proves a production Core deployment or that a separate Core
runtime remains necessary.

Those implementation boundaries continue to govern any work performed on this
legacy source. ADR-0008 must not be used to bypass its tenant, role, migration,
queue, or evidence invariants.

## Accepted disposition

ADR-0008 changes the advancing target as follows:

- `Core` means the deterministic `@mhoo/core` Twenty App, not this
  independent API, worker, database, queue, object-store adapter, or MCP
  service.
- `mhoo-twenty` owns the future App source and its compatibility with the
  governed Twenty version.
- this repository receives no new target behavior and remains a
  provenance-preserved implementation and proof record until a separate
  archival or bounded-extraction decision is reviewed;
- useful domain semantics may be re-expressed through Twenty objects,
  relations, permissions, files, jobs, tools, and views only after their source
  and meaning are inventoried; and
- no source code, database record, tenant identifier, file, credential, secret,
  API key, OAuth grant, or runtime configuration moves automatically.

The existing `tenant_id` and FORCE-RLS design remains valid evidence for the
system proved here. It would not become an authorization mechanism inside
Twenty, and it would not be copied into the proposed App merely to preserve an
old architecture box.

## Required transition gates

1. Freeze and inventory the exact Core source, schemas, tests, dependencies,
   proof records, and any data that might require a retention decision.
2. Classify each reusable concept as retain as evidence, re-express in a Twenty
   App, contribute upstream, or remove from the target.
3. Preserve immutable source path, commit, rationale, transformation, and
   verification evidence for every extracted concept.
4. Build the App from a clean Workspace with no implicit Core data or
   credential import, then prove its own permissions, records, jobs, tools, UI,
   recovery, and lifecycle behavior.
5. Approve repository archival, runtime retirement, or data disposal as
   separate actions after the replacement is proved.

Any failed or missing gate leaves the current source and evidence intact and
does not authorize the next step.
