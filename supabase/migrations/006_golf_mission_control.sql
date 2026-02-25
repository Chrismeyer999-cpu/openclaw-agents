create table if not exists public.golf_topics_trending (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('emily','laura','both')),
  topic text not null,
  hook text,
  source text,
  trend_score numeric(5,2) not null default 0,
  fit_score numeric(5,2) not null default 0,
  status text not null default 'new' check (status in ('new','backlog','planned','done')),
  detected_at timestamptz not null default now()
);

create table if not exists public.golf_series (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('emily','laura')),
  title text not null,
  theme text,
  status text not null default 'active' check (status in ('active','paused','done')),
  target_episodes integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.golf_series_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.golf_series(id) on delete cascade,
  episode_no integer not null,
  title text not null,
  hook text,
  status text not null default 'idea' check (status in ('idea','script','render','edit','scheduled','posted')),
  created_at timestamptz not null default now(),
  unique (series_id, episode_no)
);

create table if not exists public.golf_content_items (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('emily','laura')),
  title text not null,
  topic text,
  stage text not null default 'idea' check (stage in ('idea','script','shotlist','render','edit','scheduled','posted')),
  model_used text,
  estimated_cost_usd numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.golf_post_metrics (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.golf_content_items(id) on delete cascade,
  posted_at timestamptz,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  watch_time_s numeric(10,2) not null default 0,
  followers_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_golf_topics_trending_detected on public.golf_topics_trending (detected_at desc);
create index if not exists idx_golf_content_items_stage on public.golf_content_items (stage, updated_at desc);

alter table public.golf_topics_trending enable row level security;
alter table public.golf_series enable row level security;
alter table public.golf_series_episodes enable row level security;
alter table public.golf_content_items enable row level security;
alter table public.golf_post_metrics enable row level security;

create policy "authenticated_all_golf_topics_trending"
  on public.golf_topics_trending for all to authenticated using (true) with check (true);
create policy "authenticated_all_golf_series"
  on public.golf_series for all to authenticated using (true) with check (true);
create policy "authenticated_all_golf_series_episodes"
  on public.golf_series_episodes for all to authenticated using (true) with check (true);
create policy "authenticated_all_golf_content_items"
  on public.golf_content_items for all to authenticated using (true) with check (true);
create policy "authenticated_all_golf_post_metrics"
  on public.golf_post_metrics for all to authenticated using (true) with check (true);

insert into public.golf_series (account, title, theme, target_episodes)
select * from (
  values
    ('laura','Mental Game Fundamentals','focus, routine, pressure, confidence',10),
    ('emily','Rules & Etiquette Basics','baanregels + herkenbare situaties',12)
) as seed(account,title,theme,target_episodes)
where not exists (select 1 from public.golf_series s where s.title = seed.title);
