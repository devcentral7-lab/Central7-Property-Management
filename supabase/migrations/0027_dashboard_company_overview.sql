-- Admin dashboard: "Company overview" counters and "Properties added by agent"
-- (Direct vs Partner split), matching the legacy system's dashboard.
-- Period-based counters use [p_from, p_to); social queue counters are live.

create or replace function public.admin_company_overview(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'properties_added', (
      select count(*) from public.properties p
      where p.created_at >= p_from and p.created_at < p_to
    ),
    'published_by_social', (
      select count(*) from public.audit_log a
      where a.category = 'queue' and a.action = 'publish'
        and a.occurred_at >= p_from and a.occurred_at < p_to
    ),
    'republished', ev.republish,
    'closed', ev.closed,
    'dropped', ev.dropped,
    'lost', ev.lost,
    'publish_on_social', q.publish_open,
    'republish_on_social', q.republish_open,
    'drop_to_update_social', q.drop_open,
    'lost_to_update_social', q.lost_open,
    'publish_pending_approval', q.publish_pending,
    'republish_pending_approval', q.republish_pending
  )
  into v
  from (
    select
      count(*) filter (where e.action::text = 'Republish') as republish,
      count(*) filter (where e.action::text = 'Closed') as closed,
      count(*) filter (where e.action::text = 'Drop') as dropped,
      count(*) filter (where e.action::text = 'Lost') as lost
    from public.property_status_events e
    where e.archived_at is null
      and e.occurred_at >= p_from and e.occurred_at < p_to
  ) ev,
  (
    select
      count(*) filter (where s.approved_at is not null and s.approved_action = 'Publish') as publish_open,
      count(*) filter (where s.approved_at is not null and s.approved_action = 'Republish') as republish_open,
      count(*) filter (where s.approved_at is not null and s.approved_action = 'Drop') as drop_open,
      count(*) filter (where s.approved_at is not null and s.approved_action = 'Lost') as lost_open,
      count(*) filter (where s.approved_at is null and s.approved_action = 'Publish') as publish_pending,
      count(*) filter (where s.approved_at is null and s.approved_action = 'Republish') as republish_pending
    from public.social_media_queue s
    where s.completed_at is null
  ) q;

  return v;
end;
$$;

create or replace function public.listings_by_creator_contact(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 12
)
returns table (created_by_name text, total bigint, direct bigint, partner bigint)
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
  select
    coalesce(nullif(trim(p.created_by_name), ''), '(Unassigned)') as created_by_name,
    count(*)::bigint as total,
    count(*) filter (where p.contact_type::text = 'Direct')::bigint as direct,
    count(*) filter (where p.contact_type::text = 'Partner')::bigint as partner
  from public.properties p
  where p.created_at >= p_from
    and p.created_at < p_to
  group by 1
  order by 2 desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;

revoke all on function public.admin_company_overview(timestamptz, timestamptz) from public;
revoke all on function public.listings_by_creator_contact(timestamptz, timestamptz, integer) from public;
grant execute on function public.admin_company_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.listings_by_creator_contact(timestamptz, timestamptz, integer) to authenticated;
