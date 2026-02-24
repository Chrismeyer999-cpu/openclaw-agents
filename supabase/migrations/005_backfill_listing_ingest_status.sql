-- Backfill ingest_status for existing listings that were already published/skipped in legacy flows.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'status'
  ) then
    execute $sql$
      update public.listings
      set ingest_status = case
        when lower(coalesce(status, '')) in ('published', 'gepubliceerd') then 'published'
        when lower(coalesce(status, '')) in ('approved', 'goedgekeurd') then 'approved'
        when lower(coalesce(status, '')) in ('skipped', 'rejected', 'afgekeurd') then 'skipped'
        when published_at is not null then 'published'
        when coalesce(array_length(published_sites, 1), 0) > 0 then 'published'
        else coalesce(nullif(ingest_status, ''), 'pending')
      end
      where
        lower(coalesce(status, '')) in ('published', 'gepubliceerd', 'approved', 'goedgekeurd', 'skipped', 'rejected', 'afgekeurd')
        or published_at is not null
        or coalesce(array_length(published_sites, 1), 0) > 0;
    $sql$;
  else
    update public.listings
    set ingest_status = 'published'
    where
      published_at is not null
      or coalesce(array_length(published_sites, 1), 0) > 0;
  end if;
end $$;

