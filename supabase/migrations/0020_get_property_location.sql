-- Read lat/lng for edit/detail without exposing raw geography to the client.

create or replace function public.get_property_location(p_property_id uuid)
returns table (lat double precision, lng double precision)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;
  return query
  select
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng
  from public.properties p
  where p.id = p_property_id
    and p.location is not null;
end;
$$;

revoke all on function public.get_property_location(uuid) from public;
grant execute on function public.get_property_location(uuid) to authenticated;
