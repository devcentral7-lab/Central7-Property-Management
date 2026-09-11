-- properties: floors → number_of_floors (int); add view column
-- Note: amenities text[] already exists on properties (use for non-apartment listings)

alter table public.properties rename column floors to number_of_floors;

alter table public.properties
  alter column number_of_floors type integer
  using round(number_of_floors)::integer;

alter table public.properties add column if not exists view text;

update public.properties
set view = nullif(trim(type_attributes->>'view'), '')
where view is null
  and coalesce(nullif(trim(type_attributes->>'view'), ''), '') <> '';
