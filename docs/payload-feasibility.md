# Payload 3.88 feasibility: FAIL

Phase 0 tested Payload `3.88.0` with `collections: []`, `admin.disable: true`,
and GraphQL disabled against an empty isolated PostgreSQL database.

Payload initialization still created these identity-related tables:

```text
public.users
public.users_sessions
```

The normalized runtime configuration reported `adminUser: "users"` and
`authCollections: ["users"]`.

It also created `payload_jobs`, `payload_jobs_log`, `payload_kv`,
`payload_locked_documents`, `payload_preferences`, and migration support tables.
The generated `users` and session schema appears even with no configured
application collection, so hiding an Admin route would not remove the competing
identity surface.

This fails ADR-0003: Twenty is the only authority for human identity,
authentication, membership, and Workspace access. No Payload Admin, REST auth,
GraphQL auth, or Payload Jobs implementation is retained in Core Phase 0.

Reproduce the isolated observation only against the Phase-0 database:

```bash
DATABASE_URL=postgres://core_migrator:...@127.0.0.1:55432/mhoo_core_phase0 \
PAYLOAD_SECRET=phase0-feasibility-only \
pnpm payload:feasibility
```

The feasibility command uses `test/payload-feasibility.config.ts`; it is an
evidence probe, not Core runtime configuration. Reconsidering Payload requires
a new architecture decision, not a route-hiding workaround.
