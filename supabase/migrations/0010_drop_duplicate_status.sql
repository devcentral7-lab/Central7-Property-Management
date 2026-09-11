-- Replace Duplicate → Obsolete on properties, then drop Duplicate from listing_status enum

update public.properties
set status = 'Obsolete'
where status = 'Duplicate';

-- Drop dependents that block enum rewrite
drop view if exists public.property_list_cards;
drop function if exists public.dashboard_listing_counts(timestamptz, timestamptz, text);

drop policy if exists properties_select_staff on public.properties;
drop policy if exists properties_insert_staff on public.properties;
drop policy if exists properties_update_staff on public.properties;
drop policy if exists properties_delete_admin on public.properties;
drop policy if exists property_media_select on public.property_media;

alter type public.listing_status rename to listing_status_old;

create type public.listing_status as enum (
  'Active',
  'Hold',
  'Lost',
  'Drop',
  'Closed',
  'Obsolete'
);

alter table public.properties
  alter column status drop default;

alter table public.properties
  alter column status type public.listing_status
  using status::text::public.listing_status;

alter table public.properties
  alter column status set default 'Active'::public.listing_status;

drop type public.listing_status_old;

-- Recreate RLS policies
create policy properties_select_staff
  on public.properties for select
  to authenticated
  using (
    public.is_staff()
    or (
      status = 'Active'
      and do_not_publish = false
    )
  );

create policy properties_insert_staff
  on public.properties for insert
  to authenticated
  with check (public.is_staff());

create policy properties_update_staff
  on public.properties for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy properties_delete_admin
  on public.properties for delete
  to authenticated
  using (public.is_admin());

create policy property_media_select
  on public.property_media for select
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (
          public.is_staff()
          or (p.status = 'Active' and p.do_not_publish = false)
        )
    )
  );

create view public.property_list_cards
with (security_invoker = true)
as
select
  p.id,
  p.ref_no,
  p.ref_seq,
  p.created_at,
  p.created_by_name,
  p.opportunity_type,
  p.property_type,
  p.city,
  p.status,
  p.currency,
  p.price_total,
  p.budget,
  p.land_size_perch,
  p.floor_area_sqft,
  p.bedrooms,
  p.bathrooms,
  p.do_not_publish,
  p.contact_name,
  p.contact_phone_1
from public.properties p;

revoke all on public.property_list_cards from public;
revoke all on public.property_list_cards from anon;
grant select on public.property_list_cards to authenticated;

create or replace function public.dashboard_listing_counts(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_created_by_name text default null
)
returns table (
  status public.listing_status,
  property_type public.property_type,
  cnt bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.status, p.property_type, count(*)::bigint
  from public.properties p
  where (p_from is null or p.created_at >= p_from)
    and (p_to is null or p.created_at < p_to)
    and (p_created_by_name is null or p.created_by_name = p_created_by_name)
  group by p.status, p.property_type;
$$;

grant execute on function public.dashboard_listing_counts(timestamptz, timestamptz, text) to authenticated;
