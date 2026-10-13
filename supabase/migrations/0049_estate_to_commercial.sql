-- "Estate" is no longer a property type: those listings become Commercial
-- Property with sub-type Estate, and Estate leaves the admin-managed type list.
-- The enum value stays so older references still parse; updated_at is untouched.

begin;

alter table public.properties disable trigger properties_set_updated_at;

update public.properties
set property_type = 'Commercial Property',
    property_subtype = coalesce(nullif(trim(property_subtype), ''), 'Estate')
where property_type = 'Estate';

alter table public.properties enable trigger properties_set_updated_at;

update public.app_settings
set value = (
      select coalesce(jsonb_agg(v), '[]'::jsonb)
      from jsonb_array_elements_text(value) v
      where v <> 'Estate'
    ),
    updated_at = now()
where key = 'property_types' and value ? 'Estate';

commit;
