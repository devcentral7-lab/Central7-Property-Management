-- Add complex-focused amenities requested by the client.
-- Keeps any existing admin-managed order; appends only names that are not already present
-- (case-insensitive), then sorts the list alphabetically for a stable display order.

update public.app_settings
set
  value = (
    select coalesce(
      jsonb_agg(name order by lower(name), name),
      '[]'::jsonb
    )
    from (
      select distinct on (lower(name)) name
      from (
        select jsonb_array_elements_text(value) as name
        from public.app_settings
        where key = 'amenities_list'
        union all
        select unnest(array[
          'Swimming Pool and Kids'' Pool',
          'Pool and Spa Complex',
          'Mini Theatre',
          'Indoor Games Room',
          'Yoga Centre',
          'Children''s Play Area',
          'Indoor Play Zone',
          'Kids'' Library',
          'Banquet Hall',
          'Business Centre',
          'Conference and Meeting Rooms',
          '24-Hour Security',
          'Mini Supermarket',
          'Laundry Services',
          'Salon',
          'Car Wash Facility',
          'Electric Vehicle Charging Points'
        ])
      ) u
      order by lower(name), name
    ) d
  ),
  updated_at = now()
where key = 'amenities_list';
