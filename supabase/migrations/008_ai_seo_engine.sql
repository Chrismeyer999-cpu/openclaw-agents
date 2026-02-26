create table if not exists public.keyword_topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  keyword text not null,
  language text not null default 'nl',
  country text not null default 'NL',
  source text not null default 'manual',
  trend_score numeric(5,2) not null default 0,
  competition_score numeric(5,2) not null default 0,
  priority_score numeric(5,2) not null default 0,
  status text not null default 'new' check (status in ('new','queued','in_progress','done','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitor_watchlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  competitor_domain text not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (workspace_id, competitor_domain)
);

alter table public.keyword_topics enable row level security;
alter table public.competitor_watchlist enable row level security;

create policy "authenticated_all_keyword_topics"
  on public.keyword_topics for all to authenticated using (true) with check (true);

create policy "authenticated_all_competitor_watchlist"
  on public.competitor_watchlist for all to authenticated using (true) with check (true);

insert into public.delivery_status_items (site, domain_area, status, works_now, not_working_yet, next_step)
select *
from (
  values
    ('platform','AI-SEO Engine / Fase 1 Keyword Feed','partial','Google/GA4/GSC datalagen actief','Keyword feed nog niet automatisch gevuld','Daily trend sync + competitor watchlist runs activeren'),
    ('platform','AI-SEO Engine / Fase 2 Knowledge Base','planned','Editorial style + anti-slop regels staan','Geen centrale knowledge ingest pipeline','Docs/transcripts/site-ingest module toevoegen'),
    ('platform','AI-SEO Engine / Fase 3 Content Lifecycle','partial','Nieuwsflow pending -> approved -> published werkt','Volledige autoblog governance modes ontbreken','Full/Plan/Review modus als schakelaar bouwen'),
    ('platform','AI-SEO Engine / Fase 4 Technical Agents','planned','Basis schema/SEO checks aanwezig','Bulk apply technical fixes nog niet agentisch','Site optimizer agent met explain-why bouwen'),
    ('platform','AI-SEO Engine / Fase 5 LLM Visibility','partial','LLM zichtbaarheid tab bestaat','Sentiment/citation depth ontbreekt','Prompt suites + citation tracking uitbreiden')
) as seed(site, domain_area, status, works_now, not_working_yet, next_step)
where not exists (
  select 1 from public.delivery_status_items d where d.site=seed.site and d.domain_area=seed.domain_area
);
