create table if not exists public.dashboard_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  status text not null default 'open' check (status in ('open','doing','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dashboard_todos_status_priority on public.dashboard_todos (status, priority, created_at desc);

alter table public.dashboard_todos enable row level security;

create policy "authenticated_all_dashboard_todos"
  on public.dashboard_todos
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.dashboard_todos (title, notes, priority, status)
select *
from (
  values
    ('Run Supabase migration 003_cost_ga4.sql', 'Nodig voor cost_tracking, agent_budgets en ga4_page_snapshots', 'high', 'open'),
    ('Configure GA4 env vars', 'GA4_PROPERTY_ID + GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'high', 'open'),
    ('Implement GA4 daily sync job', 'Fetch per nieuws-URL en schrijf naar ga4_page_snapshots', 'high', 'open'),
    ('Implement GSC daily sync for nieuws URLs', 'Gebruik workspace gsc_property + refresh token', 'high', 'open'),
    ('Add nieuws performance columns in dashboard', 'Impressions, CTR, position, sessions, engagement', 'medium', 'open')
) as seed(title, notes, priority, status)
where not exists (
  select 1 from public.dashboard_todos d where d.title = seed.title
);
