-- Admin dashboard detail tables, matching the legacy dashboard:
--   * listings added per agent per month (current year) and per day (current month)
--   * status by property type and city breakdown for listings added in [p_from, p_to)
--   * Do Not Publish listings added in [p_from, p_to)
--   * social media daily activity: queue items marked done per day by action, and
--     the Publish / Republish backlog still open at the end of each day
-- Days and months are bucketed in Asia/Colombo. Aggregates only, except the
-- Do Not Publish list (no contact details).

create or replace function public.admin_dashboard_details(
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
  v_tz constant text := 'Asia/Colombo';
  v_local_now timestamp := now() at time zone 'Asia/Colombo';
  v_year_start timestamptz := date_trunc('year', v_local_now) at time zone 'Asia/Colombo';
  v_month_start timestamptz := date_trunc('month', v_local_now) at time zone 'Asia/Colombo';
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'monthly_by_agent', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket, 'agent', agent, 'value', cnt))
      from (
        select to_char(p.created_at at time zone v_tz, 'YYYY-MM') as bucket,
               coalesce(nullif(trim(p.created_by_name), ''), '(Unassigned)') as agent,
               count(*) as cnt
        from public.properties p
        where p.created_at >= v_year_start
        group by 1, 2
      ) t
    ), '[]'::jsonb),

    'daily_by_agent', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket, 'agent', agent, 'value', cnt))
      from (
        select to_char(p.created_at at time zone v_tz, 'DD') as bucket,
               coalesce(nullif(trim(p.created_by_name), ''), '(Unassigned)') as agent,
               count(*) as cnt
        from public.properties p
        where p.created_at >= v_month_start
        group by 1, 2
      ) t
    ), '[]'::jsonb),

    'status_by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', ptype, 'status', status, 'value', cnt))
      from (
        select p.property_type::text as ptype, p.status::text as status, count(*) as cnt
        from public.properties p
        where p.created_at >= p_from and p.created_at < p_to
        group by 1, 2
      ) t
    ), '[]'::jsonb),

    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', cnt) order by cnt desc, name)
      from (
        select coalesce(nullif(trim(p.city), ''), 'Unspecified') as name, count(*) as cnt
        from public.properties p
        where p.created_at >= p_from and p.created_at < p_to
        group by 1
      ) t
    ), '[]'::jsonb),

    'do_not_publish', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref_no', d.ref_no,
        'agent', d.created_by_name,
        'opportunity', d.opportunity_type,
        'type', d.property_type,
        'city', d.city,
        'created_at', d.created_at
      ) order by d.created_at desc)
      from (
        select p.ref_no, p.created_by_name, p.opportunity_type::text as opportunity_type,
               p.property_type::text as property_type, p.city, p.created_at
        from public.properties p
        where p.do_not_publish
          and p.created_at >= p_from and p.created_at < p_to
        order by p.created_at desc
        limit 500
      ) d
    ), '[]'::jsonb),

    'social_done', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'action', action, 'value', cnt))
      from (
        select (a.occurred_at at time zone v_tz)::date as day,
               coalesce(nullif(a.details->>'queue_action', ''), q.approved_action, 'Publish') as action,
               count(*) as cnt
        from public.audit_log a
        left join public.social_media_queue q on q.ref_no = a.subject_label
        where a.category = 'queue'
          and a.action = 'publish'
          and a.occurred_at >= p_from and a.occurred_at < p_to
        group by 1, 2
      ) t
    ), '[]'::jsonb),

    'social_backlog', coalesce((
      select jsonb_agg(jsonb_build_object('day', day::date, 'publish', pub, 'republish', rep) order by day)
      from (
        select g.day,
               count(q.id) filter (where q.approved_action in ('Publish', 'New Ad Published')) as pub,
               count(q.id) filter (where q.approved_action = 'Republish') as rep
        from generate_series(
          date_trunc('day', p_from at time zone v_tz),
          date_trunc('day', p_to at time zone v_tz),
          interval '1 day'
        ) as g(day)
        left join public.social_media_queue q
          on q.approved_at is not null
         and q.approved_action in ('Publish', 'New Ad Published', 'Republish')
         and q.approved_at < ((g.day + interval '1 day') at time zone v_tz)
         and (q.completed_at is null
              or q.completed_at >= ((g.day + interval '1 day') at time zone v_tz))
        group by g.day
      ) b
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_dashboard_details(timestamptz, timestamptz) from public;
grant execute on function public.admin_dashboard_details(timestamptz, timestamptz) to authenticated;
