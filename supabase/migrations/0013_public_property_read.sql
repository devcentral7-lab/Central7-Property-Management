-- Allow public (anon) read of Active, publishable listings only.
-- Contacts remain protected: public UI selects non-contact columns only.

drop policy if exists properties_select_public_active on public.properties;
create policy properties_select_public_active
  on public.properties for select
  to anon
  using (status = 'Active' and do_not_publish = false);

-- Public list DTO without contact fields
drop view if exists public.property_public_cards;
create view public.property_public_cards
with (security_invoker = true)
as
select
  p.id,
  p.ref_no,
  p.ref_seq,
  p.created_at,
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
  p.do_not_publish
from public.properties p
where p.status = 'Active' and p.do_not_publish = false;

grant select on public.property_public_cards to anon, authenticated;
revoke all on public.property_public_cards from public;
