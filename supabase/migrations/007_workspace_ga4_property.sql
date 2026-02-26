alter table public.workspaces
  add column if not exists ga4_property text;

update public.workspaces
set ga4_property = case domain
  when 'zwijsen.net' then '311994957'
  when 'kavelarchitect.nl' then '501966172'
  when 'brikxai.nl' then '518816847'
  else ga4_property
end
where domain in ('zwijsen.net','kavelarchitect.nl','brikxai.nl');
