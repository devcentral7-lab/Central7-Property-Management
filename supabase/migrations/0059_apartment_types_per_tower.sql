-- Store apartment types per tower/wing as [{ "name": "...", "types": ["Type A", ...] }, ...].
alter table public.apartment_complexes
  alter column apartment_types drop default;

alter table public.apartment_complexes
  alter column apartment_types type jsonb
  using (
    case
      when apartment_types is null or cardinality(apartment_types) = 0 then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object('name', '', 'types', to_jsonb(apartment_types))
      )
    end
  );

alter table public.apartment_complexes
  alter column apartment_types set default '[]'::jsonb;

alter table public.apartment_complexes
  alter column apartment_types set not null;
