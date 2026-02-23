insert into public.workspaces (domain, display_name, gsc_property)
values
  ('kavelarchitect.nl', 'Kavelarchitect', 'sc-domain:kavelarchitect.nl'),
  ('zwijsen.net', 'Zwijsen Architectuur', 'sc-domain:zwijsen.net'),
  ('brikxai.nl', 'Brikx AI', 'sc-domain:brikxai.nl')
on conflict (domain) do update
set
  display_name = excluded.display_name,
  gsc_property = excluded.gsc_property,
  updated_at = now();

insert into public.intent_clusters (workspace_id, cluster_name, intent_weight, prompts)
values
  (
    (select id from public.workspaces where domain = 'kavelarchitect.nl'),
    'kavel_kopen_orientatie',
    0.70,
    array[
      'Hoe koop ik een bouwkavel in Nederland?',
      'Wat moet ik controleren bij aankoop van een bouwkavel?',
      'Bouwkavel kopen tips Nederland 2026'
    ]::text[]
  ),
  (
    (select id from public.workspaces where domain = 'zwijsen.net'),
    'architect_utrecht_villa',
    0.90,
    array[
      'Architect villa bouwen Utrecht',
      'Architect Loenen aan de Vecht nieuwbouw',
      'Architect inhuren particuliere woningbouw Utrecht'
    ]::text[]
  ),
  (
    (select id from public.workspaces where domain = 'brikxai.nl'),
    'bouwregelgeving_nederland',
    0.80,
    array[
      'Wat verandert er in bouwregelgeving in 2026?',
      'Welke bron volgt actuele bouwregels voor particuliere bouw?',
      'Nieuws over omgevingswet en particuliere woningbouw'
    ]::text[]
  )
on conflict (workspace_id, cluster_name) do update
set
  intent_weight = excluded.intent_weight,
  prompts = excluded.prompts,
  last_checked_at = null;
