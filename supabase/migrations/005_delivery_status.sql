create table if not exists public.delivery_status_items (
  id uuid primary key default gen_random_uuid(),
  site text not null check (site in ('zwijsen.net','brikxai.nl','kavelarchitect.nl','platform')),
  domain_area text not null,
  status text not null check (status in ('working','partial','planned','blocked')),
  works_now text,
  not_working_yet text,
  next_step text,
  owner text not null default 'Jules',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_status_site_status on public.delivery_status_items (site, status, updated_at desc);

alter table public.delivery_status_items enable row level security;

create policy "authenticated_all_delivery_status_items"
  on public.delivery_status_items
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.delivery_status_items (site, domain_area, status, works_now, not_working_yet, next_step)
select *
from (
  values
    ('platform','Nieuwsflow orchestratie','working','Pending/approved/published flow met review in dashboard','Volledige auto-publish gate nog in tuning','Top-5 per site selectie finetunen met performance feedback'),
    ('platform','Google data koppeling','partial','GSC + GA4 sync endpoint en status aanwezig','Cron scheduling + robuuste error retries nog niet af','Dagelijkse cron job met run logging toevoegen'),
    ('platform','Cost monitoring','partial','Cost tables + dashboard signalen + budget alerts zichtbaar','Hard kill-switch per agent nog niet volledig afgedwongen','Agent-level enabled flag in runtime checks afdwingen'),

    ('zwijsen.net','Nieuwsselectie','partial','AI/trend-focus en projectshowcase-filtering actief','Scoring nog niet op echte performance getraind','Top-performing thema’s automatisch boosten'),
    ('zwijsen.net','Publicatiekwaliteit','working','Editorial style guide + rationale verplicht','Automatische beeldsuggestie nog beperkt','Image suggestion flow met reviewbadge toevoegen'),

    ('brikxai.nl','Nieuwsflow','working','Regelgeving/kosten filters actief in ingest','Koppeling met concrete tool-conversie nog beperkt meetbaar','CTA-event tracking per artikel toevoegen'),
    ('brikxai.nl','SEO/LLM basis','partial','Dashboard heeft SEO + LLM tabbladen','Per artikel gecombineerde scorekaart ontbreekt','Nieuws performance table (SEO+GA4+LLM) tonen'),

    ('kavelarchitect.nl','Kavel + nieuws koppeling','partial','Kavelnieuws selectie en pending queue werkt','Nieuwe kavel database nog niet ingericht','Aparte kavel-db en sync flow opzetten'),
    ('kavelarchitect.nl','Contentkwaliteit','working','Style guide en review flow in place','Regionale filters nog uitgeschakeld (bewust)','Regionale toggle in settings toevoegen')
) as seed(site, domain_area, status, works_now, not_working_yet, next_step)
where not exists (
  select 1 from public.delivery_status_items d where d.site = seed.site and d.domain_area = seed.domain_area
);
