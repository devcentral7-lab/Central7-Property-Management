-- Commercial listings: the "Purpose" field is replaced by "Suitable for",
-- stored in type_attributes.suitable_for (same place Land keeps it).
-- Moves existing commercial purpose values over so nothing disappears from
-- the form. Only touches rows that don't already have a suitable_for value.
-- updated_at is left untouched: this is a field rename, not a user edit.

begin;

alter table public.properties disable trigger properties_set_updated_at;

update public.properties
set
  type_attributes = coalesce(type_attributes, '{}'::jsonb)
    || jsonb_build_object('suitable_for', trim(purpose)),
  purpose = null
where property_type = 'Commercial Property'
  and nullif(trim(purpose), '') is not null
  and nullif(trim(type_attributes ->> 'suitable_for'), '') is null;

alter table public.properties enable trigger properties_set_updated_at;

commit;
