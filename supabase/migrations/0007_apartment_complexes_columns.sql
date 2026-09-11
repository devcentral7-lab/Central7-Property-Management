-- apartment_complexes: rename amenities; add developer / apartments_per_floor / notes
alter table public.apartment_complexes rename column default_amenities to amenities;
alter table public.apartment_complexes add column if not exists developer text;
alter table public.apartment_complexes add column if not exists apartments_per_floor integer;
alter table public.apartment_complexes add column if not exists notes text;
