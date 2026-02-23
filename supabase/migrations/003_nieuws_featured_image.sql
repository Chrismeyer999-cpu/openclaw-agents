alter table if exists public.nieuws
  add column if not exists featured_image_url text,
  add column if not exists featured_image_alt text;

