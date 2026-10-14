-- Search filters evaluate these for every listing; almost none have any social
-- media history, so answer those without running property_social_status.
-- No is_staff() check per row: properties rows are only readable by staff, and
-- anon can't execute these.

create or replace function public.social_state(p public.properties)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.social_media_queue q where q.ref_no = p.ref_no)
     and not exists (
       select 1 from public.audit_log a
       where a.category = 'queue' and a.subject_label = p.ref_no
     )
      then 'never'
    else public.property_social_status(p.ref_no)->>'state'
  end;
$$;

-- Same rule as "pending" in property_social_status.
create or replace function public.social_pending(p public.properties)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when q.approved_at is null then 'awaiting_approval' else 'approved' end
  from public.social_media_queue q
  where q.ref_no = p.ref_no
    and q.completed_at is null
    and cardinality(q.requested_platforms) > 0;
$$;

revoke all on function public.social_state(public.properties) from public, anon;
revoke all on function public.social_pending(public.properties) from public, anon;
grant execute on function public.social_state(public.properties) to authenticated;
grant execute on function public.social_pending(public.properties) to authenticated;
