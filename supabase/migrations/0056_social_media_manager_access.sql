-- Social Media Manager helpers, queue access, and social dashboard RPC.

create or replace function public.is_social_media_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and p.role = 'Social Media Manager'::public.staff_role
  );
$$;

revoke all on function public.is_social_media_manager() from public;
grant execute on function public.is_social_media_manager() to authenticated;

create or replace function public.can_access_social_media_queue()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or public.is_social_media_manager()
    or exists (
      select 1
      from public.app_settings s
      where s.key = 'social_media_queue_allow_list'
        and s.value @> to_jsonb(coalesce(public.current_display_name(), ''))
    );
$$;

-- Social daily/monthly activity for Admins and Social Media Managers (and allow-list).
create or replace function public.social_media_dashboard_details(
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
begin
  if not public.can_access_social_media_queue() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'social_done', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'action', action, 'value', cnt))
      from (
        select (x.done_at at time zone v_tz)::date as day, x.action, count(*) as cnt
        from (
          select a.occurred_at as done_at,
                 coalesce(nullif(a.details->>'queue_action', ''), q.approved_action, 'Publish') as action
          from public.audit_log a
          left join public.social_media_queue q on q.ref_no = a.subject_label
          where a.category = 'queue'
            and a.action = 'publish'
            and a.occurred_at >= p_from and a.occurred_at < p_to
          union all
          select q.completed_at, coalesce(nullif(q.approved_action, ''), 'Publish')
          from public.social_media_queue q
          where q.completed_at >= p_from and q.completed_at < p_to
            and not exists (
              select 1
              from public.audit_log a
              where a.category = 'queue'
                and a.action = 'publish'
                and a.subject_label = q.ref_no
                and a.occurred_at between q.completed_at - interval '5 minutes'
                                      and q.completed_at + interval '5 minutes'
            )
        ) x
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

revoke all on function public.social_media_dashboard_details(timestamptz, timestamptz) from public;
grant execute on function public.social_media_dashboard_details(timestamptz, timestamptz) to authenticated;
