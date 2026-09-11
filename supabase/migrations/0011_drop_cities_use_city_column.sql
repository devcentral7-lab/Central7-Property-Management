-- Drop cities lookup table; keep a single text city column on properties

drop view if exists public.property_list_cards;

alter table public.properties drop column if exists city_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'city_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'city'
  ) then
    alter table public.properties rename column city_name to city;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'city_name'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'city'
  ) then
    update public.properties
    set city = coalesce(nullif(trim(city), ''), city_name)
    where city is null or trim(city) = '';
    alter table public.properties drop column city_name;
  end if;
end $$;

drop index if exists properties_city_id_idx;
drop index if exists properties_city_name_idx;
create index if not exists properties_city_idx on public.properties (city);

drop table if exists public.cities cascade;

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
