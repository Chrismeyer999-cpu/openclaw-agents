create table if not exists public.dso_jobs (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  result_json jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dso_jobs_status_created on public.dso_jobs (status, created_at desc);

alter table public.dso_jobs enable row level security;

create policy "authenticated_all_dso_jobs"
  on public.dso_jobs for all to authenticated using (true) with check (true);
