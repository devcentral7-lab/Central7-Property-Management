-- Apartment type names on complexes (e.g. Type A, Type B), stored as a list.
alter table public.apartment_complexes
  add column if not exists apartment_types text[] not null default '{}';
