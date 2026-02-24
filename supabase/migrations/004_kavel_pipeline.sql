create extension if not exists pgcrypto;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  kavel_id text not null unique,
  funda_id text,
  source_type text not null default 'manual' check (source_type in ('gmail_funda', 'openclaw', 'manual')),
  ingest_status text not null default 'pending' check (ingest_status in ('pending', 'approved', 'published', 'skipped', 'error')),
  adres text,
  postcode text,
  plaats text,
  provincie text,
  prijs numeric,
  oppervlakte numeric,
  source_url text,
  image_url text,
  map_url text,
  specs jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_summary text,
  seo_article_html text,
  seo_summary_ka text,
  seo_article_html_ka text,
  seo_summary_zw text,
  seo_article_html_zw text,
  published_sites text[] not null default '{}'::text[],
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings
  add column if not exists funda_id text,
  add column if not exists source_type text,
  add column if not exists ingest_status text,
  add column if not exists specs jsonb,
  add column if not exists seo_summary_ka text,
  add column if not exists seo_article_html_ka text,
  add column if not exists seo_summary_zw text,
  add column if not exists seo_article_html_zw text,
  add column if not exists published_sites text[],
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.listings
set
  source_type = coalesce(nullif(source_type, ''), 'manual'),
  ingest_status = coalesce(nullif(ingest_status, ''), 'pending'),
  specs = coalesce(specs, '{}'::jsonb),
  published_sites = coalesce(published_sites, '{}'::text[]),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.listings
  alter column source_type set default 'manual',
  alter column ingest_status set default 'pending',
  alter column specs set default '{}'::jsonb,
  alter column published_sites set default '{}'::text[],
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_source_type_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_source_type_check check (source_type in ('gmail_funda', 'openclaw', 'manual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_ingest_status_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_ingest_status_check check (ingest_status in ('pending', 'approved', 'published', 'skipped', 'error'));
  end if;
end $$;

create table if not exists public.kavels (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  slug text not null unique,
  title text not null,
  excerpt text,
  location text,
  region text,
  price numeric,
  area numeric,
  status text not null default 'beschikbaar' check (status in ('beschikbaar', 'optie', 'verkocht', 'on_hold')),
  featured_image_url text,
  featured_image_alt text,
  description text,
  source_url text,
  published_sites text[] not null default array['zwijsen.net', 'kavelarchitect.nl']::text[],
  published_at timestamptz not null default now(),
  latitude numeric,
  longitude numeric,
  max_ridge_height numeric,
  seo_article_html_zw text,
  seo_summary_zw text,
  seo_article_html_ka text,
  seo_summary_ka text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kavel_alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  naam text,
  telefoonnummer text,
  status text not null default 'actief' check (status in ('actief', 'pauze', 'uitgeschreven')),
  provincies text[] not null default '{}'::text[],
  min_prijs numeric,
  max_prijs numeric,
  min_oppervlakte numeric,
  bouwstijl text,
  tijdslijn text,
  bouwbudget text,
  kavel_type text,
  dienstverlening text not null default 'zoek',
  early_access_rapport boolean not null default false,
  opmerkingen text,
  source text not null default 'dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kavel_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('gmail_funda', 'openclaw')),
  status text not null default 'queued' check (status in ('queued', 'running', 'success', 'error')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'cron', 'webhook')),
  requested_by uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listings_status_created_at on public.listings (ingest_status, created_at desc);
create index if not exists idx_listings_source_status_created_at on public.listings (source_type, ingest_status, created_at desc);
create index if not exists idx_listings_source_url on public.listings (source_url);
create index if not exists idx_kavels_published_at on public.kavels (published_at desc);
create index if not exists idx_kavels_sites on public.kavels using gin (published_sites);
create index if not exists idx_kavel_alert_status_created_at on public.kavel_alert_subscribers (status, created_at desc);
create index if not exists idx_kavel_sync_jobs_created_at on public.kavel_sync_jobs (created_at desc);

alter table public.listings enable row level security;
alter table public.kavels enable row level security;
alter table public.kavel_alert_subscribers enable row level security;
alter table public.kavel_sync_jobs enable row level security;

create policy "authenticated_all_listings"
  on public.listings
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_kavels"
  on public.kavels
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_kavel_alert_subscribers"
  on public.kavel_alert_subscribers
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_kavel_sync_jobs"
  on public.kavel_sync_jobs
  for all
  to authenticated
  using (true)
  with check (true);
