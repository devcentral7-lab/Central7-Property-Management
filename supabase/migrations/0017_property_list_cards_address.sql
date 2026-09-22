-- Include address on staff list cards so property search can filter by it.

drop view if exists public.property_list_cards;

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
  p.address,
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
