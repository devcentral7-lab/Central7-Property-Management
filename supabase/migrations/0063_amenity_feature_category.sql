-- Store amenities_list as { name, category } objects (feature | amenity).
-- Legacy plain strings still load; saving normalizes to objects.

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
  normalized jsonb;
  feature_defaults text[] := array[
    'air conditioning',
    'balcony',
    'maids room',
    'maids toilet',
    'sea view',
    'garage',
    'study room',
    'store room',
    'servant quarters',
    'lift/elevator',
    'water tank',
    'solar panels',
    'generator',
    'cctv'
  ];
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

  if p_key = 'amenities_list' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', name,
          'category', category
        )
        order by ord
      ),
      '[]'::jsonb
    )
    into normalized
    from (
      select
        ord,
        name,
        case
          when category in ('feature', 'amenity') then category
          when lower(name) = any (feature_defaults) then 'feature'
          else 'amenity'
        end as category
      from (
        select
          ord,
          case
            when jsonb_typeof(elem) = 'object' then trim(both from coalesce(elem ->> 'name', ''))
            else trim(both from elem #>> '{}')
          end as name,
          case
            when jsonb_typeof(elem) = 'object' then lower(trim(both from coalesce(elem ->> 'category', '')))
            else null
          end as category
        from jsonb_array_elements(p_items) with ordinality as t(elem, ord)
      ) parsed
      where name <> ''
    ) cleaned;

    insert into public.app_settings (key, value, updated_at)
    values (p_key, normalized, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
    return;
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

-- Convert any legacy string amenities_list entries to { name, category }.
update public.app_settings
set
  value = coalesce(
    (
      select jsonb_agg(
        case
          when jsonb_typeof(elem) = 'object'
            and nullif(trim(both from coalesce(elem ->> 'name', '')), '') is not null
          then jsonb_build_object(
            'name', trim(both from elem ->> 'name'),
            'category',
            case
              when lower(trim(both from coalesce(elem ->> 'category', ''))) in ('feature', 'amenity')
                then lower(trim(both from elem ->> 'category'))
              when lower(trim(both from elem ->> 'name')) = any (array[
                'air conditioning', 'balcony', 'maids room', 'maids toilet', 'sea view',
                'garage', 'study room', 'store room', 'servant quarters', 'lift/elevator',
                'water tank', 'solar panels', 'generator', 'cctv'
              ]) then 'feature'
              else 'amenity'
            end
          )
          when nullif(trim(both from elem #>> '{}'), '') is not null
          then jsonb_build_object(
            'name', trim(both from elem #>> '{}'),
            'category',
            case
              when lower(trim(both from elem #>> '{}')) = any (array[
                'air conditioning', 'balcony', 'maids room', 'maids toilet', 'sea view',
                'garage', 'study room', 'store room', 'servant quarters', 'lift/elevator',
                'water tank', 'solar panels', 'generator', 'cctv'
              ]) then 'feature'
              else 'amenity'
            end
          )
          else null
        end
        order by ord
      )
      from jsonb_array_elements(value) with ordinality as t(elem, ord)
    ),
    '[]'::jsonb
  ),
  updated_at = now()
where key = 'amenities_list'
  and jsonb_typeof(value) = 'array';
