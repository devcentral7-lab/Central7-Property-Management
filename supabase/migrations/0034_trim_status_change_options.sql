-- Update status dropdown: drop Publish, Hold, New Ad Published and Obsolete.
-- Keeps any other items an Admin has added. Enum values stay, so past events still load.

update public.app_settings
set value = coalesce(
      (
        select jsonb_agg(item order by ord)
        from jsonb_array_elements(value) with ordinality as t(item, ord)
        where item #>> '{}' not in ('Publish', 'Hold', 'New Ad Published', 'Obsolete')
      ),
      '[]'::jsonb
    ),
    updated_at = now()
where key = 'status_change_options';
