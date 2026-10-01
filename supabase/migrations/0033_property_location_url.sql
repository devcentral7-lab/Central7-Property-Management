-- Listings store a pasted Google Maps link instead of a map pin picked through
-- the Maps JavaScript API. Existing pins are carried over as links.

alter table public.properties
  add column if not exists location_url text;

update public.properties
set location_url = 'https://www.google.com/maps?q='
  || round(ST_Y(location::geometry)::numeric, 6) || ','
  || round(ST_X(location::geometry)::numeric, 6)
where location is not null
  and location_url is null;
