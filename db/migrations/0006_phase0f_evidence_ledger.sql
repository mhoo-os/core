do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'core_recorder') then
    create role core_recorder nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end
$$;

create table if not exists core.evidence_records (
  evidence_id uuid primary key,
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  twenty_workspace_id_reference text not null,
  content_key text not null check (content_key ~ '^sha256/[a-f0-9]{64}$'),
  content_sha256 char(64) not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  source_system text not null,
  source_instance_reference text,
  external_object_id text not null,
  source_revision text,
  original_reference_uri text,
  acquisition_mechanism text not null,
  acquired_at timestamptz not null,
  observed_at timestamptz not null,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  creation_idempotency_key text not null,
  creation_payload_sha256 char(64) not null check (creation_payload_sha256 ~ '^[a-f0-9]{64}$'),
  initial_provenance_event_id char(64) not null check (initial_provenance_event_id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (content_key = 'sha256/' || content_sha256),
  unique (tenant_id, acquisition_mechanism, creation_idempotency_key)
);

create table if not exists core.evidence_provenance_events (
  provenance_event_id char(64) primary key check (provenance_event_id ~ '^[a-f0-9]{64}$'),
  evidence_id uuid not null references core.evidence_records (evidence_id),
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  event_type text not null check (event_type in ('evidence.observed', 'evidence.recorded', 'evidence.superseded', 'evidence.retracted', 'evidence.invalidated')),
  lifecycle_sequence integer not null check (lifecycle_sequence > 0),
  predecessor_event_id char(64),
  idempotency_key text not null,
  event_occurred_at timestamptz,
  recorded_at timestamptz not null,
  actor_kind text not null check (actor_kind in ('connector', 'importer', 'core_process', 'retention_policy')),
  actor_reference text not null,
  actor_version text not null,
  execution_reference text,
  prior_lifecycle_state text,
  new_lifecycle_state text not null check (new_lifecycle_state in ('observed', 'recorded', 'superseded', 'retracted', 'invalidated')),
  causation_event_id char(64),
  related_evidence_id uuid,
  external_cause_reference text,
  correlation_reference text,
  provenance_snapshot_or_typed_reason jsonb not null,
  event_payload_sha256 char(64) not null check (event_payload_sha256 ~ '^[a-f0-9]{64}$'),
  check ((lifecycle_sequence = 1) = (predecessor_event_id is null)),
  check ((lifecycle_sequence = 1) = (event_type = 'evidence.observed')),
  check (event_type = 'evidence.' || new_lifecycle_state),
  unique (evidence_id, lifecycle_sequence),
  unique (evidence_id, predecessor_event_id)
);

alter table core.evidence_provenance_events alter column recorded_at drop default;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'core.evidence_provenance_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%new_lifecycle_state%'
      and pg_get_constraintdef(oid) like '%related_evidence_id%'
  loop
    execute format('alter table core.evidence_provenance_events drop constraint %I', constraint_name);
  end loop;
  alter table core.evidence_provenance_events
    add constraint evidence_events_supersession_replacement_check
    check (new_lifecycle_state <> 'superseded' or related_evidence_id is not null);
end $$;

create table if not exists core.evidence_lifecycle_heads (
  evidence_id uuid primary key references core.evidence_records (evidence_id),
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  current_event_id char(64) not null references core.evidence_provenance_events (provenance_event_id),
  current_state text not null check (current_state in ('observed', 'recorded', 'superseded', 'retracted', 'invalidated')),
  lifecycle_sequence integer not null check (lifecycle_sequence > 0)
);

create index if not exists evidence_records_tenant_id_index on core.evidence_records (tenant_id);
create index if not exists evidence_events_tenant_sequence_index on core.evidence_provenance_events (tenant_id, evidence_id, lifecycle_sequence);

alter table core.evidence_records enable row level security;
alter table core.evidence_records force row level security;
alter table core.evidence_provenance_events enable row level security;
alter table core.evidence_provenance_events force row level security;
alter table core.evidence_lifecycle_heads enable row level security;
alter table core.evidence_lifecycle_heads force row level security;

drop policy if exists evidence_records_tenant_isolation on core.evidence_records;
create policy evidence_records_tenant_isolation on core.evidence_records using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
drop policy if exists evidence_events_tenant_isolation on core.evidence_provenance_events;
create policy evidence_events_tenant_isolation on core.evidence_provenance_events using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
drop policy if exists evidence_heads_tenant_isolation on core.evidence_lifecycle_heads;
create policy evidence_heads_tenant_isolation on core.evidence_lifecycle_heads using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create or replace function core.reject_evidence_ledger_mutation() returns trigger language plpgsql as $$ begin raise exception 'Evidence records and provenance events are append-only'; end $$;
create or replace function core.evidence_lifecycle_transition_is_legal(prior_state text, next_state text) returns boolean language sql immutable as $$
  select (prior_state = 'observed' and next_state in ('recorded', 'invalidated'))
      or (prior_state = 'recorded' and next_state in ('superseded', 'retracted', 'invalidated'))
      or (prior_state = 'superseded' and next_state in ('retracted', 'invalidated'))
      or (prior_state = 'retracted' and next_state = 'invalidated')
$$;

create or replace function core.validate_evidence_provenance_event() returns trigger language plpgsql as $$
declare
  tip core.evidence_lifecycle_heads%rowtype;
  replacement core.evidence_lifecycle_heads%rowtype;
begin
  if new.lifecycle_sequence = 1 then
    if new.tenant_id is distinct from (select tenant_id from core.evidence_records where evidence_id = new.evidence_id)
       or new.provenance_event_id is distinct from (select initial_provenance_event_id from core.evidence_records where evidence_id = new.evidence_id)
       or new.prior_lifecycle_state is not null
       or new.new_lifecycle_state <> 'observed'
       or new.causation_event_id is not null
       or new.related_evidence_id is not null then
      raise exception 'Initial evidence event does not match its immutable observation';
    end if;
    return new;
  end if;

  select * into tip from core.evidence_lifecycle_heads where evidence_id = new.evidence_id for update;
  if not found
     or tip.tenant_id <> new.tenant_id
     or tip.current_event_id <> new.predecessor_event_id
     or tip.lifecycle_sequence + 1 <> new.lifecycle_sequence
     or tip.current_state <> new.prior_lifecycle_state
     or not core.evidence_lifecycle_transition_is_legal(tip.current_state, new.new_lifecycle_state) then
    raise exception 'Evidence lifecycle event is not a valid successor of the current tip';
  end if;
  if new.new_lifecycle_state = 'recorded' and current_user <> 'core_recorder' then
    raise exception 'Evidence recording requires the core_recorder boundary';
  end if;
  if new.causation_event_id is not null then
    perform 1 from core.evidence_provenance_events
      where provenance_event_id = new.causation_event_id
        and tenant_id = new.tenant_id;
    if not found then
      raise exception 'Evidence event causation reference must resolve within the tenant';
    end if;
  end if;
  if new.related_evidence_id is not null then
    perform 1 from core.evidence_records
      where evidence_id = new.related_evidence_id
        and tenant_id = new.tenant_id;
    if not found then
      raise exception 'Evidence event related evidence reference must resolve within the tenant';
    end if;
  end if;
  if new.new_lifecycle_state = 'superseded' then
    select * into replacement
      from core.evidence_lifecycle_heads
      where evidence_id = new.related_evidence_id
        and tenant_id = new.tenant_id
      for share;
    if not found
       or replacement.evidence_id = new.evidence_id
       or replacement.current_state <> 'recorded' then
      raise exception 'Superseded evidence requires a same-tenant recorded replacement evidence';
    end if;
  end if;
  return new;
end $$;

create or replace function core.validate_evidence_lifecycle_head() returns trigger language plpgsql as $$
declare
  event_row core.evidence_provenance_events%rowtype;
begin
  select * into event_row from core.evidence_provenance_events where provenance_event_id = new.current_event_id;
  if not found
     or event_row.evidence_id <> new.evidence_id
     or event_row.tenant_id <> new.tenant_id
     or event_row.new_lifecycle_state <> new.current_state
     or event_row.lifecycle_sequence <> new.lifecycle_sequence then
    raise exception 'Evidence lifecycle head does not match its ledger event';
  end if;
  if tg_op = 'UPDATE' and (
    new.evidence_id <> old.evidence_id
    or new.tenant_id <> old.tenant_id
    or new.lifecycle_sequence <> old.lifecycle_sequence + 1
    or event_row.predecessor_event_id <> old.current_event_id
  ) then
    raise exception 'Evidence lifecycle head update is not a single valid successor';
  end if;
  return new;
end $$;

create or replace function core.assert_new_event_is_current_tip() returns trigger language plpgsql as $$
declare
  tip core.evidence_lifecycle_heads%rowtype;
begin
  select * into tip from core.evidence_lifecycle_heads where evidence_id = new.evidence_id;
  if not found
     or tip.tenant_id <> new.tenant_id
     or tip.current_event_id <> new.provenance_event_id
     or tip.current_state <> new.new_lifecycle_state
     or tip.lifecycle_sequence <> new.lifecycle_sequence then
    raise exception 'New evidence event was not atomically projected to the lifecycle head';
  end if;
  return null;
end $$;

drop trigger if exists evidence_records_append_only on core.evidence_records;
create trigger evidence_records_append_only before update or delete on core.evidence_records for each row execute function core.reject_evidence_ledger_mutation();
drop trigger if exists evidence_events_append_only on core.evidence_provenance_events;
create trigger evidence_events_append_only before update or delete on core.evidence_provenance_events for each row execute function core.reject_evidence_ledger_mutation();
drop trigger if exists evidence_events_validate_successor on core.evidence_provenance_events;
create trigger evidence_events_validate_successor before insert on core.evidence_provenance_events for each row execute function core.validate_evidence_provenance_event();
drop trigger if exists evidence_heads_validate_projection on core.evidence_lifecycle_heads;
create trigger evidence_heads_validate_projection before insert or update on core.evidence_lifecycle_heads for each row execute function core.validate_evidence_lifecycle_head();
drop trigger if exists evidence_event_must_be_current_tip on core.evidence_provenance_events;
create constraint trigger evidence_event_must_be_current_tip after insert on core.evidence_provenance_events deferrable initially deferred for each row execute function core.assert_new_event_is_current_tip();

grant usage on schema core to core_recorder;
grant select on core.workspace_bindings to core_recorder;
grant select, insert on core.evidence_records, core.evidence_provenance_events to core_api, core_worker;
grant select, insert, update on core.evidence_lifecycle_heads to core_api, core_worker;
grant select on core.evidence_records to core_recorder;
grant select, insert on core.evidence_provenance_events to core_recorder;
grant select, update on core.evidence_lifecycle_heads to core_recorder;
