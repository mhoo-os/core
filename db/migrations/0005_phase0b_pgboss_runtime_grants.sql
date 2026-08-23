-- This migration runs only after the migrator has installed or upgraded the
-- pg-boss schema using the package's version-matched construction/migration
-- plan. Runtime roles may operate existing queues; they may not create or
-- alter the pg-boss schema or queues.
revoke all on schema pgboss from public;
grant usage on schema pgboss to core_api, core_worker;
grant select, insert, update, delete on all tables in schema pgboss to core_api, core_worker;
grant usage, select on all sequences in schema pgboss to core_api, core_worker;
