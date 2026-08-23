create schema if not exists core;

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists core.workspace_bindings (
  tenant_id uuid primary key,
  twenty_workspace_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists core.evidence_objects (
  id uuid primary key,
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  object_key text not null,
  sha256 char(64) not null,
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, object_key)
);

create table if not exists core.phase0_embeddings (
  id uuid primary key,
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  label text not null,
  embedding vector(8) not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, label)
);

create index if not exists phase0_embeddings_tenant_id_index
  on core.phase0_embeddings (tenant_id);

alter table core.evidence_objects enable row level security;
alter table core.evidence_objects force row level security;
alter table core.phase0_embeddings enable row level security;
alter table core.phase0_embeddings force row level security;
drop policy if exists evidence_objects_tenant_isolation on core.evidence_objects;
create policy evidence_objects_tenant_isolation on core.evidence_objects
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

drop policy if exists phase0_embeddings_tenant_isolation on core.phase0_embeddings;
create policy phase0_embeddings_tenant_isolation on core.phase0_embeddings
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
