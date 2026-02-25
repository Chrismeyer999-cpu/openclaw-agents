create table if not exists public.agent_budgets (
  agent_name text primary key,
  monthly_budget_usd numeric(10,2) not null default 0,
  cost_threshold_usd numeric(10,2) not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.cost_tracking (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  model text,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  cost_estimate_usd numeric(12,6),
  within_threshold boolean,
  run_at timestamptz not null default now()
);

create table if not exists public.ga4_page_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_url text not null,
  snapshot_date date not null,
  sessions integer not null default 0,
  engaged_sessions integer not null default 0,
  engagement_rate numeric(6,4) not null default 0,
  avg_engagement_time_s numeric(10,2) not null default 0,
  cta_clicks integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, page_url, snapshot_date)
);

create index if not exists idx_cost_tracking_agent_run_at on public.cost_tracking (agent_name, run_at desc);
create index if not exists idx_ga4_snapshots_workspace_date on public.ga4_page_snapshots (workspace_id, snapshot_date desc);

create or replace view public.monthly_costs as
select
  agent_name,
  date_trunc('month', run_at)::date as month,
  sum(cost_usd)::numeric(12,6) as spent_usd,
  sum(tokens_input) as tokens_input,
  sum(tokens_output) as tokens_output
from public.cost_tracking
group by agent_name, date_trunc('month', run_at)::date;

alter table public.agent_budgets enable row level security;
alter table public.cost_tracking enable row level security;
alter table public.ga4_page_snapshots enable row level security;

create policy "authenticated_all_agent_budgets"
  on public.agent_budgets
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_cost_tracking"
  on public.cost_tracking
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_ga4_page_snapshots"
  on public.ga4_page_snapshots
  for all
  to authenticated
  using (true)
  with check (true);
