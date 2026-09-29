-- Admin dashboard charts: opportunity mix (all inventory) and top cities
-- (Active listings). Aggregates only — no property rows leave the database.

create or replace function public.dashboard_inventory_breakdowns(
  p_city_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'opportunity', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', cnt) order by cnt desc)
      from (
        select coalesce(nullif(trim(p.opportunity_type::text), ''), 'Unspecified') as name,
               count(*) as cnt
        from public.properties p
        group by 1
      ) o
    ), '[]'::jsonb),
    'active_cities', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', cnt) order by cnt desc)
      from (
        select coalesce(nullif(trim(p.city), ''), 'Unspecified') as name,
               count(*) as cnt
        from public.properties p
        where p.status::text = 'Active'
        group by 1
        order by 2 desc
        limit greatest(1, least(coalesce(p_city_limit, 10), 25))
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.dashboard_inventory_breakdowns(integer) from public;
grant execute on function public.dashboard_inventory_breakdowns(integer) to authenticated;
