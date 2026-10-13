-- The app now shows each form list in its saved order (Admins reorder them on
-- the Form Options tab). Store every list in the order it was being displayed
-- so nothing moves until an Admin reorders it: alphabetical, except Opportunity
-- and Property Types, which use the agreed business order.

begin;

update public.app_settings
set value = (
      select coalesce(jsonb_agg(x order by lower(x), x), '[]'::jsonb)
      from jsonb_array_elements_text(value) as t(x)
    ),
    updated_at = now()
where key in (
  'amenities_list',
  'contact_types',
  'furnished_list',
  'currencies',
  'status_list',
  'social_media_platforms',
  'status_change_options'
);

update public.app_settings
set value = (
      select coalesce(jsonb_agg(x order by coalesce(array_position(array['Sell', 'Rent Out'], x), 99), lower(x)), '[]'::jsonb)
      from jsonb_array_elements_text(value) as t(x)
    ),
    updated_at = now()
where key = 'opportunity_types';

update public.app_settings
set value = (
      select coalesce(jsonb_agg(x order by coalesce(array_position(array['Apartment', 'House', 'Land', 'Commercial Property'], x), 99), lower(x)), '[]'::jsonb)
      from jsonb_array_elements_text(value) as t(x)
    ),
    updated_at = now()
where key = 'property_types';

commit;
