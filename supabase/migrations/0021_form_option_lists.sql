-- Admin-editable form option lists (dropdowns / amenity checkboxes).
-- amenities_list already seeded in 0001; add the rest and an enum-sync helper.

insert into public.app_settings (key, value) values
  ('contact_types', '["Direct","Partner"]'::jsonb),
  ('opportunity_types', '["Sell","Rent Out"]'::jsonb),
  ('property_types', '["House","Land","Apartment","Commercial Property","Estate"]'::jsonb),
  ('furnished_list', '["Not Furnished","Partly Furnished","Fully Furnished"]'::jsonb),
  ('currencies', '["LKR","USD"]'::jsonb),
  ('status_list', '["Active","Hold","Lost","Drop","Closed","Obsolete"]'::jsonb),
  ('social_media_platforms', '["Ikman","LPW","Facebook","Instagram"]'::jsonb),
  ('status_change_options', '["Publish","Republish","Drop","Lost","Hold","New Ad Published","Closed","Data Change","Obsolete"]'::jsonb)
on conflict (key) do nothing;

-- Keep amenities_list present even if somehow missing.
insert into public.app_settings (key, value) values
  ('amenities_list', '[
    "Swimming Pool","Rooftop","Rooftop Garden","Rumpus Room (Room for games)","Gym",
    "Garden Space","Maids Room","Maids Toilet","Bar Area","Servant Quarters","Solar Panels",
    "Generator","CCTV","Lift/Elevator","Balcony","Garage","Study Room","Store Room",
    "Air Conditioning","Sea View","Water Tank"
  ]'::jsonb)
on conflict (key) do nothing;

-- Extend Postgres enums when an Admin adds a new dropdown value that columns still use as enums.
create or replace function public.admin_ensure_enum_value(
  p_enum_type text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'contact_type',
    'opportunity_type',
    'property_type',
    'furnished_status',
    'currency_code',
    'listing_status',
    'social_platform',
    'activity_action'
  ];
  exists_already boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_value is null or length(trim(p_value)) = 0 then
    raise exception 'empty enum value';
  end if;
  if not (p_enum_type = any (allowed)) then
    raise exception 'enum type not allowed: %', p_enum_type;
  end if;

  select exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = p_enum_type
      and e.enumlabel = p_value
  ) into exists_already;

  if exists_already then
    return;
  end if;

  execute format(
    'alter type public.%I add value %L',
    p_enum_type,
    p_value
  );
end;
$$;

revoke all on function public.admin_ensure_enum_value(text, text) from public;
grant execute on function public.admin_ensure_enum_value(text, text) to authenticated;

-- Atomically replace a form option list (json array of strings). Syncs enums when needed.
create or replace function public.admin_set_form_list(
  p_key text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_keys constant text[] := array[
    'amenities_list',
    'contact_types',
    'opportunity_types',
    'property_types',
    'furnished_list',
    'currencies',
    'status_list',
    'social_media_platforms',
    'status_change_options'
  ];
  enum_map jsonb := jsonb_build_object(
    'contact_types', 'contact_type',
    'opportunity_types', 'opportunity_type',
    'property_types', 'property_type',
    'furnished_list', 'furnished_status',
    'currencies', 'currency_code',
    'status_list', 'listing_status',
    'social_media_platforms', 'social_platform',
    'status_change_options', 'activity_action'
  );
  item text;
  enum_type text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not (p_key = any (allowed_keys)) then
    raise exception 'unknown form list key: %', p_key;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'items must be a json array';
  end if;

  for item in
    select trim(both from x)
    from jsonb_array_elements_text(p_items) as t(x)
  loop
    if item = '' then
      raise exception 'blank list items are not allowed';
    end if;
  end loop;

  enum_type := enum_map ->> p_key;
  if enum_type is not null then
    for item in
      select trim(both from x)
      from jsonb_array_elements_text(p_items) as t(x)
    loop
      perform public.admin_ensure_enum_value(enum_type, item);
    end loop;
  end if;

  insert into public.app_settings (key, value, updated_at)
  values (
    p_key,
    coalesce(
      (
        select jsonb_agg(to_jsonb(trim(both from x)) order by ord)
        from jsonb_array_elements_text(p_items) with ordinality as t(x, ord)
        where trim(both from x) <> ''
      ),
      '[]'::jsonb
    ),
    now()
  )
  on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
end;
$$;

revoke all on function public.admin_set_form_list(text, jsonb) from public;
grant execute on function public.admin_set_form_list(text, jsonb) to authenticated;
