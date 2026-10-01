-- Apartment complexes: add "Nemra", created in the legacy "Apartment Complexes"
-- table after 0032 was generated.

insert into public.apartment_complexes (name, location, amenities, added_by, address, built_year)
values
  ('Nemra', 'Wattala', array['Swimming pool', 'Gym', 'Dedicated resident parking', 'Visitor parking', 'Lift/elevator', 'Security']::text[], 'Sherden', 'St. Anthony’s Mawatha, Wattala', null)
on conflict (name) do update set
  location = coalesce(excluded.location, apartment_complexes.location),
  amenities = case when cardinality(excluded.amenities) > 0 then excluded.amenities else apartment_complexes.amenities end,
  added_by = coalesce(excluded.added_by, apartment_complexes.added_by),
  address = coalesce(excluded.address, apartment_complexes.address);
