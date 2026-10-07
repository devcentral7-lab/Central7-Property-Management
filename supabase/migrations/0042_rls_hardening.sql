-- Make the database enforce the same Admin rules as the app screens.
-- Server actions that act for listing owners or queue operators check access in
-- code and then write with the service role (auth.uid() is null there).

-- ---------------------------------------------------------------------------
-- Profiles: only Admin creates profiles; new logins start inactive; names are
-- Admin-only because permissions are keyed on display_name.
-- ---------------------------------------------------------------------------

drop policy if exists profiles_insert_admin_or_self_user on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'User');

  -- Partner agents must not get a profiles row
  if meta_role = 'Agent' then
    return new;
  end if;

  -- Inactive until an Admin turns it on; Admin onboarding sets active itself.
  insert into public.profiles (id, display_name, role, mobile_number, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'User',
    new.raw_user_meta_data->>'mobile_number',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.profiles_prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only Admin can change profiles.role';
  end if;

  if new.active is distinct from old.active then
    raise exception 'Only Admin can change profiles.active';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Cannot change profiles.id';
  end if;

  if new.display_name is distinct from old.display_name then
    raise exception 'Only Admin can change profiles.display_name';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Properties: staff add listings as themselves; only Admin edits them.
-- ---------------------------------------------------------------------------

drop policy if exists properties_insert_staff on public.properties;
drop policy if exists properties_insert_own on public.properties;
create policy properties_insert_own
  on public.properties for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_staff()
      and created_by = auth.uid()
      and created_by_name = public.current_display_name()
    )
  );

drop policy if exists properties_update_staff on public.properties;
drop policy if exists properties_update_admin on public.properties;
create policy properties_update_admin
  on public.properties for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Status events (activity history): staff file requests as themselves;
-- only Admin edits history.
-- ---------------------------------------------------------------------------

drop policy if exists status_events_insert_staff on public.property_status_events;
drop policy if exists status_events_insert_own on public.property_status_events;
create policy status_events_insert_own
  on public.property_status_events for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_staff()
      and actor_id = auth.uid()
      and actor_name = public.current_display_name()
      and resolved_at is null
      and resolved_by is null
      and archived_at is null
    )
  );

drop policy if exists status_events_update_staff on public.property_status_events;
drop policy if exists status_events_update_admin on public.property_status_events;
create policy status_events_update_admin
  on public.property_status_events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Social media queue: only Admin creates, approves or deletes items. Queue
-- operators may only tick platforms and mark items done / reopen them.
-- ---------------------------------------------------------------------------

drop policy if exists smq_insert_staff on public.social_media_queue;
drop policy if exists smq_insert_admin on public.social_media_queue;
create policy smq_insert_admin
  on public.social_media_queue for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists smq_delete_allow_list on public.social_media_queue;
drop policy if exists smq_delete_admin on public.social_media_queue;
create policy smq_delete_admin
  on public.social_media_queue for delete
  to authenticated
  using (public.is_admin());

create or replace function public.smq_guard_operator_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.approved_action is distinct from old.approved_action
    or new.requested_platforms is distinct from old.requested_platforms
    or new.property_id is distinct from old.property_id
    or new.ref_no is distinct from old.ref_no
    or new.comment is distinct from old.comment
  then
    raise exception 'Only Admin can change approval details on the social media queue';
  end if;

  return new;
end;
$$;

drop trigger if exists smq_guard_operator_update on public.social_media_queue;
create trigger smq_guard_operator_update
before update on public.social_media_queue
for each row execute function public.smq_guard_operator_update();

-- ---------------------------------------------------------------------------
-- Audit log: written only by the server (service role), which passes the
-- signed-in user's id. Signed-in users can no longer add entries directly.
-- ---------------------------------------------------------------------------

drop function if exists public.log_audit_event(
  text, text, text, text, text, text, text, text, jsonb, text, text
);

create or replace function public.log_audit_event(
  p_category text,
  p_action text,
  p_actor_name text default null,
  p_actor_kind text default null,
  p_subject_type text default null,
  p_subject_id text default null,
  p_subject_label text default null,
  p_summary text default null,
  p_details jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(auth.uid(), p_actor_id);
  v_kind text;
  v_name text;
  v_id uuid;
begin
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'category required';
  end if;
  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'action required';
  end if;

  v_kind := coalesce(
    nullif(trim(p_actor_kind), ''),
    case
      when v_uid is null then 'unknown'
      when exists (
        select 1 from public.profiles p
        where p.id = v_uid and p.active
      ) then 'staff'
      when exists (
        select 1 from public.users u
        where u.auth_user_id = v_uid and u.active and u.status = 'Approved'
      ) then 'agent'
      else 'unknown'
    end
  );

  v_name := nullif(trim(coalesce(p_actor_name, '')), '');
  if v_name is null and v_uid is not null then
    select p.display_name into v_name
    from public.profiles p where p.id = v_uid;
  end if;
  if v_name is null and v_uid is not null then
    select coalesce(u.company_name, u.username) into v_name
    from public.users u where u.auth_user_id = v_uid;
  end if;

  insert into public.audit_log (
    category,
    action,
    actor_id,
    actor_name,
    actor_kind,
    subject_type,
    subject_id,
    subject_label,
    summary,
    details,
    ip,
    user_agent
  ) values (
    nullif(trim(p_category), ''),
    nullif(trim(p_action), ''),
    v_uid,
    v_name,
    v_kind,
    nullif(trim(p_subject_type), ''),
    nullif(trim(p_subject_id), ''),
    nullif(trim(p_subject_label), ''),
    nullif(trim(p_summary), ''),
    coalesce(p_details, '{}'::jsonb),
    nullif(trim(p_ip), ''),
    nullif(trim(p_user_agent), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_audit_event(
  text, text, text, text, text, text, text, text, jsonb, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.log_audit_event(
  text, text, text, text, text, text, text, text, jsonb, text, text, uuid
) to service_role;
