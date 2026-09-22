-- Admin analytics RPCs: return aggregates only (never property rows).
-- Keeps free-tier egress tiny for ~10k+ listings.

create or replace function public.listings_created_by_day(
  p_from timestamptz,
  p_to timestamptz
)
returns table (day date, cnt bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select (p.created_at at time zone 'UTC')::date as day, count(*)::bigint
  from public.properties p
  where p.created_at >= p_from
    and p.created_at < p_to
  group by 1
  order by 1;
end;
$$;

create or replace function public.listings_by_creator(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 8
)
returns table (created_by_name text, cnt bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select coalesce(nullif(trim(p.created_by_name), ''), '(Unassigned)') as created_by_name,
         count(*)::bigint
  from public.properties p
  where p.created_at >= p_from
    and p.created_at < p_to
  group by 1
  order by 2 desc
  limit greatest(1, least(coalesce(p_limit, 8), 25));
end;
$$;

create or replace function public.status_event_action_counts(
  p_from timestamptz,
  p_to timestamptz,
  p_actions text[] default array['Drop', 'Lost', 'Closed', 'Republish']
)
returns table (action text, cnt bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select e.action::text, count(*)::bigint
  from public.property_status_events e
  where e.archived_at is null
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
    and e.action::text = any (p_actions)
  group by e.action
  order by 2 desc;
end;
$$;

-- Inventory totals without downloading rows
create or replace function public.inventory_kpi_counts()
returns table (total bigint, active bigint, added_30d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := (now() at time zone 'utc') - interval '30 days';
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    (select count(*)::bigint from public.properties),
    (select count(*)::bigint from public.properties p where p.status = 'Active'),
    (select count(*)::bigint from public.properties p where p.created_at >= v_from);
end;
$$;

revoke all on function public.listings_created_by_day(timestamptz, timestamptz) from public;
revoke all on function public.listings_by_creator(timestamptz, timestamptz, integer) from public;
revoke all on function public.status_event_action_counts(timestamptz, timestamptz, text[]) from public;
revoke all on function public.inventory_kpi_counts() from public;

grant execute on function public.listings_created_by_day(timestamptz, timestamptz) to authenticated;
grant execute on function public.listings_by_creator(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.status_event_action_counts(timestamptz, timestamptz, text[]) to authenticated;
grant execute on function public.inventory_kpi_counts() to authenticated;
