-- Helper to set property map point without sending geography from the client.

create or replace function public.set_property_location(
  p_property_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;
  if p_lat is null or p_lng is null then
    update public.properties set location = null where id = p_property_id;
    return;
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates';
  end if;
  update public.properties
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  where id = p_property_id;
end;
$$;

revoke all on function public.set_property_location(uuid, double precision, double precision) from public;
grant execute on function public.set_property_location(uuid, double precision, double precision) to authenticated;
