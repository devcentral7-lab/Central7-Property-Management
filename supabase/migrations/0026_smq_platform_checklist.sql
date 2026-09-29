-- Social media queue: per-platform checklist.
--   platform_dates = { "<Platform>": { "at": timestamptz, "by": display name } }
-- An item can only be marked Done (completed_at) once every requested
-- platform has an entry. approved_action keeps the original intent
-- (Publish / Drop / Hold ...) instead of being overwritten on approve/publish.

create or replace function public.smq_platforms_complete(
  p_platforms public.social_platform[],
  p_dates jsonb
)
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(coalesce(p_dates, '{}'::jsonb) ? p::text), true)
  from unnest(coalesce(p_platforms, '{}')) as p;
$$;

-- Restore intent on rows whose approved_action was overwritten with a status
-- word: use the latest matching workflow event, else "Publish".
update public.social_media_queue q
set approved_action = coalesce(
  (
    select e.action::text
    from public.property_status_events e
    where e.ref_no = q.ref_no
      and e.action::text in ('Publish', 'Republish', 'Drop', 'Lost', 'Hold', 'Closed', 'New Ad Published')
    order by e.occurred_at desc
    limit 1
  ),
  'Publish'
)
where q.approved_action is null
   or q.approved_action in ('Approved', 'Published');

-- Legacy published rows predate the checklist: treat their platforms as done.
update public.social_media_queue q
set platform_dates = coalesce(q.platform_dates, '{}'::jsonb) || (
  select coalesce(
    jsonb_object_agg(p::text, jsonb_build_object('at', q.completed_at, 'by', q.approved_by)),
    '{}'::jsonb
  )
  from unnest(q.requested_platforms) as p
  where not (coalesce(q.platform_dates, '{}'::jsonb) ? p::text)
)
where q.completed_at is not null
  and not public.smq_platforms_complete(q.requested_platforms, q.platform_dates);

alter table public.social_media_queue
  drop constraint if exists social_media_queue_done_requires_all_platforms;

alter table public.social_media_queue
  add constraint social_media_queue_done_requires_all_platforms
  check (
    completed_at is null
    or public.smq_platforms_complete(requested_platforms, platform_dates)
  );

-- Tick / untick one platform atomically (no read-modify-write races between
-- operators). Runs as the caller, so the SMQ update RLS policy still applies.
create or replace function public.set_smq_platform_done(
  p_id uuid,
  p_platform text,
  p_done boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.social_media_queue%rowtype;
begin
  select * into v_row
  from public.social_media_queue
  where id = p_id
  for update;

  if not found then
    raise exception 'Queue item not found';
  end if;
  if v_row.approved_at is null then
    raise exception 'Approve this item on the Activity log first';
  end if;
  if v_row.completed_at is not null then
    raise exception 'Item is already done — reopen it to change platforms';
  end if;
  if not (p_platform = any (v_row.requested_platforms::text[])) then
    raise exception 'Platform % was not requested for this item', p_platform;
  end if;

  update public.social_media_queue
  set platform_dates = case
    when p_done then
      coalesce(platform_dates, '{}'::jsonb)
        || jsonb_build_object(
          p_platform,
          jsonb_build_object('at', now(), 'by', public.current_display_name())
        )
    else coalesce(platform_dates, '{}'::jsonb) - p_platform
  end
  where id = p_id
  returning platform_dates into v_row.platform_dates;

  if not found then
    raise exception 'Not allowed to update this queue item';
  end if;

  return v_row.platform_dates;
end;
$$;

revoke all on function public.set_smq_platform_done(uuid, text, boolean) from public;
grant execute on function public.set_smq_platform_done(uuid, text, boolean) to authenticated;
grant execute on function public.smq_platforms_complete(public.social_platform[], jsonb) to authenticated;
