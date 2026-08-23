do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'core_runtime') then
    create role core_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end
$$;

revoke all on schema core from public;
grant usage on schema core to core_runtime;
grant select on core.workspace_bindings to core_runtime;
grant select, insert, update on core.evidence_objects to core_runtime;
grant select, insert, update on core.phase0_embeddings to core_runtime;
