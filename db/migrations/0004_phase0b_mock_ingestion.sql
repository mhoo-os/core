create table if not exists core.phase0b_ingestions (
  id uuid primary key,
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  document_id text not null,
  source_revision text not null,
  transform_version text not null,
  ingestion_status text not null check (ingestion_status in ('queued', 'processing', 'completed', 'failed')),
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, document_id, source_revision, transform_version)
);

create table if not exists core.phase0b_items (
  chunk_key char(64) primary key,
  tenant_id uuid not null references core.workspace_bindings (tenant_id),
  ingestion_id uuid not null references core.phase0b_ingestions (id),
  document_id text not null,
  source_revision text not null,
  transform_version text not null,
  chunk_ordinal integer not null check (chunk_ordinal between 1 and 100),
  content_hash char(64) not null,
  normalized_content text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, document_id, source_revision, transform_version, chunk_ordinal)
);

create index if not exists phase0b_ingestions_tenant_id_index
  on core.phase0b_ingestions (tenant_id);

create index if not exists phase0b_items_tenant_id_index
  on core.phase0b_items (tenant_id);

alter table core.phase0b_ingestions enable row level security;
alter table core.phase0b_ingestions force row level security;
alter table core.phase0b_items enable row level security;
alter table core.phase0b_items force row level security;

drop policy if exists phase0b_ingestions_tenant_isolation on core.phase0b_ingestions;
create policy phase0b_ingestions_tenant_isolation on core.phase0b_ingestions
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

drop policy if exists phase0b_items_tenant_isolation on core.phase0b_items;
create policy phase0b_items_tenant_isolation on core.phase0b_items
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

grant select, insert, update on core.phase0b_ingestions to core_api, core_worker;
grant select, insert, update on core.phase0b_items to core_api, core_worker;
