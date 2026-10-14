-- Social media status of a listing, worked out from finished queue items
-- (audit_log "publish" entries, plus imported queue rows finished without one)
-- and the listing's current queue row. Used by the property details card and,
-- through the social_state / social_pending computed columns, by search filters.
--
-- Returns { state: published | taken_down | never,
--           live: [{ platform, at }], removed: { action, platforms, at } | null,
--           pending: { action, stage: awaiting_approval | approved, platforms, done } | null }

create index if not exists audit_log_queue_subject_idx
  on public.audit_log (subject_label, occurred_at)
  where category = 'queue';

create or replace function public.property_social_status(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_live_actions constant text[] := array['Publish', 'Republish', 'New Ad Published', 'Data Change'];
  v_q public.social_media_queue%rowtype;
  v_finished jsonb := '[]'::jsonb;
  v_ev record;
  v_action text;
  v_requested text[];
  v_dates jsonb;
  v_done text[] := '{}';
  v_pending jsonb;
  v_live jsonb := '{}'::jsonb;
  v_removed jsonb;
  v_item jsonb;
  v_platforms text[];
  v_p text;
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  -- Each "publish" is a finished queue item; "revert_publish" reopens the latest one.
  for v_ev in
    select a.action, a.occurred_at, a.details
    from public.audit_log a
    where a.category = 'queue'
      and a.subject_label = p_ref
      and a.action in ('publish', 'revert_publish')
    order by a.occurred_at
  loop
    if v_ev.action = 'revert_publish' then
      if jsonb_array_length(v_finished) > 0 then
        v_finished := v_finished - (jsonb_array_length(v_finished) - 1);
      end if;
    else
      v_finished := v_finished || jsonb_build_array(jsonb_build_object(
        'action', coalesce(nullif(v_ev.details->>'queue_action', ''), 'Publish'),
        'platforms', case when jsonb_typeof(v_ev.details->'platforms') = 'array'
                          then v_ev.details->'platforms' else '[]'::jsonb end,
        'at', v_ev.occurred_at
      ));
    end if;
  end loop;

  select * into v_q from public.social_media_queue where ref_no = p_ref;
  if found then
    v_action := coalesce(nullif(v_q.approved_action, ''), 'Publish');
    v_requested := coalesce(v_q.requested_platforms::text[], '{}');
    v_dates := coalesce(v_q.platform_dates, '{}'::jsonb);
    if v_q.completed_at is not null then
      -- Imported queue items were finished without a "publish" audit entry.
      if not exists (
        select 1 from jsonb_array_elements(v_finished) f
        where abs(extract(epoch from ((f->>'at')::timestamptz - v_q.completed_at))) < 300
      ) then
        v_finished := v_finished || jsonb_build_array(jsonb_build_object(
          'action', v_action,
          'platforms', case when v_dates <> '{}'::jsonb
                            then (select jsonb_agg(k.key) from jsonb_each(v_dates) k)
                            else to_jsonb(v_requested) end,
          'at', v_q.completed_at
        ));
      end if;
    elsif cardinality(v_requested) > 0 then
      if v_q.approved_at is not null then
        select coalesce(array_agg(p), '{}') into v_done
        from unnest(v_requested) p
        where v_dates ? p;
        -- Platforms already ticked off count as posted / removed.
        foreach v_p in array v_done loop
          v_finished := v_finished || jsonb_build_array(jsonb_build_object(
            'action', v_action,
            'platforms', jsonb_build_array(v_p),
            'at', coalesce(v_dates->v_p->>'at', v_q.approved_at::text)
          ));
        end loop;
      end if;
      v_pending := jsonb_build_object(
        'action', v_action,
        'stage', case when v_q.approved_at is null then 'awaiting_approval' else 'approved' end,
        'platforms', to_jsonb(v_requested),
        'done', to_jsonb(v_done)
      );
    end if;
  end if;

  for v_item in
    select e.value
    from jsonb_array_elements(v_finished) e
    order by (e.value->>'at')::timestamptz
  loop
    select coalesce(array_agg(x), '{}') into v_platforms
    from jsonb_array_elements_text(v_item->'platforms') x;
    if (v_item->>'action') = any (v_live_actions) then
      foreach v_p in array v_platforms loop
        v_live := v_live || jsonb_build_object(v_p, v_item->'at');
      end loop;
    elsif cardinality(v_platforms) > 0 then
      v_live := v_live - v_platforms;
      v_removed := jsonb_build_object(
        'action', v_item->>'action',
        'platforms', to_jsonb(v_platforms),
        'at', v_item->'at'
      );
    end if;
  end loop;

  return jsonb_build_object(
    'state', case
      when v_live <> '{}'::jsonb then 'published'
      when v_removed is not null then 'taken_down'
      else 'never'
    end,
    'live', coalesce(
      (select jsonb_agg(jsonb_build_object('platform', l.key, 'at', l.value) order by l.key)
       from jsonb_each(v_live) l),
      '[]'::jsonb
    ),
    'removed', case when v_live = '{}'::jsonb then v_removed end,
    'pending', v_pending
  );
end;
$$;

revoke all on function public.property_social_status(text) from public, anon;
grant execute on function public.property_social_status(text) to authenticated;

-- Computed columns, so PostgREST can filter: ?social_state=eq.published
create or replace function public.social_state(p public.properties)
returns text
language sql
stable
as $$
  select public.property_social_status(p.ref_no)->>'state';
$$;

create or replace function public.social_pending(p public.properties)
returns text
language sql
stable
as $$
  select public.property_social_status(p.ref_no)->'pending'->>'stage';
$$;

revoke all on function public.social_state(public.properties) from public, anon;
revoke all on function public.social_pending(public.properties) from public, anon;
grant execute on function public.social_state(public.properties) to authenticated;
grant execute on function public.social_pending(public.properties) to authenticated;
