create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  display_name text not null,
  gsc_property text,
  gsc_refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pillar_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  title text not null,
  page_type text not null check (page_type in ('pillar', 'regio', 'faq', 'kennisbank', 'nieuws')),
  intent_type text not null check (intent_type in ('informational', 'commercial', 'advisory', 'transactional')),
  target_keywords text[] not null default '{}',
  expected_schema_types text[] not null default '{}',
  detected_schema_types text[] not null default '{}',
  has_schema boolean not null default false,
  last_audited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, url)
);

create table if not exists public.gsc_snapshots (
  id uuid primary key default gen_random_uuid(),
  pillar_page_id uuid not null references public.pillar_pages(id) on delete cascade,
  snapshot_date date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(5,4) not null default 0,
  avg_position numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (pillar_page_id, snapshot_date)
);

create table if not exists public.intent_clusters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cluster_name text not null,
  intent_weight numeric(3,2) not null default 0.5 check (intent_weight >= 0 and intent_weight <= 1),
  prompts text[] not null default '{}',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, cluster_name)
);

create table if not exists public.llm_mentions (
  id uuid primary key default gen_random_uuid(),
  intent_cluster_id uuid not null references public.intent_clusters(id) on delete cascade,
  prompt text not null,
  llm_source text not null check (llm_source in ('openai', 'perplexity', 'gemini')),
  mentioned boolean not null default false,
  mention_snippet text,
  response_hash text,
  checked_at timestamptz not null default now()
);

create table if not exists public.nieuws (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  summary text,
  body_md text,
  source_url text,
  source_type text not null check (source_type in ('dso', 'rss', 'kavel', 'agent', 'manual')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_gsc_snapshots_page_date on public.gsc_snapshots (pillar_page_id, snapshot_date desc);
create index if not exists idx_llm_mentions_cluster_checked on public.llm_mentions (intent_cluster_id, checked_at desc);
create index if not exists idx_nieuws_workspace_status on public.nieuws (workspace_id, review_status, created_at desc);

alter table public.workspaces enable row level security;
alter table public.pillar_pages enable row level security;
alter table public.gsc_snapshots enable row level security;
alter table public.intent_clusters enable row level security;
alter table public.llm_mentions enable row level security;
alter table public.nieuws enable row level security;

create policy "authenticated_all_workspaces"
  on public.workspaces
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_pillar_pages"
  on public.pillar_pages
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_gsc_snapshots"
  on public.gsc_snapshots
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_intent_clusters"
  on public.intent_clusters
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_llm_mentions"
  on public.llm_mentions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_nieuws"
  on public.nieuws
  for all
  to authenticated
  using (true)
  with check (true);
