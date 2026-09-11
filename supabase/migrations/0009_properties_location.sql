-- Exact map pin for Google Maps (WGS84). Stored after address in logical schema.
-- Usage examples:
--   ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
--   ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng

create extension if not exists postgis;

alter table public.properties
  add column if not exists location geography(Point, 4326);

create index if not exists properties_location_idx
  on public.properties using gist (location);
