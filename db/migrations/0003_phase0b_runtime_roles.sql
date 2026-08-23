do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'core_api') then
    create role core_api nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'core_worker') then
    create role core_worker nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end
$$;

revoke all on schema core from public;
grant usage on schema core to core_api, core_worker;
grant select on core.workspace_bindings to core_api, core_worker;
grant select, insert, update on core.evidence_objects to core_api, core_worker;
grant select, insert, update on core.phase0_embeddings to core_api, core_worker;
