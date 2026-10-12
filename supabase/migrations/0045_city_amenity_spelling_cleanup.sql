-- Align listing cities and amenities with the admin-managed lists so searches
-- and the edit form find them. Renames only; updated_at is left untouched.

begin;

alter table public.properties disable trigger properties_set_updated_at;

update public.properties set city = 'Battaramulla' where city = 'Battramulla';
update public.properties set city = 'Negombo' where city = 'Negambo';
update public.properties set city = 'Thalawathugoda' where city = 'Thalawatugoda';
update public.properties set city = 'Colombo 04' where city = 'Colombo-04';

update public.app_settings
set value = (
      select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
      from jsonb_array_elements_text(value) v
      where v <> 'Colombo-04'
    ),
    updated_at = now()
where key = 'cities' and value ? 'Colombo-04';

-- Amenities that differ from a list entry only by case, spaces or punctuation
-- ("Roof top", "Swimming pool") take the list spelling; duplicates collapse.
with list as (
  select a as name, regexp_replace(lower(a), '[^a-z0-9]', '', 'g') as k
  from public.app_settings, jsonb_array_elements_text(value) a
  where key = 'amenities_list'
),
fixed as (
  select p.id,
         array_agg(d.v order by d.o) as amenities
  from public.properties p
  cross join lateral (
    select coalesce(l.name, t.a) as v, min(t.o) as o
    from unnest(p.amenities) with ordinality t(a, o)
    left join list l on l.k = regexp_replace(lower(t.a), '[^a-z0-9]', '', 'g')
    group by coalesce(l.name, t.a)
  ) d
  where p.amenities is not null and cardinality(p.amenities) > 0
  group by p.id
)
update public.properties p
set amenities = f.amenities
from fixed f
where f.id = p.id and f.amenities is distinct from p.amenities;

alter table public.properties enable trigger properties_set_updated_at;

commit;
