-- Audit hardening: lock privilege escalation, stop public PII on properties,
-- gate RPCs, tighten queue + partner insert RLS.
-- Public listing data is served only via property_public_cards (definer view).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_display_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name
  from public.profiles p
  where p.id = auth.uid()
    and p.active
  limit 1;
$$;

create or replace function public.can_access_social_media_queue()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.app_settings s
      where s.key = 'social_media_queue_allow_list'
        and s.value @> to_jsonb(coalesce(public.current_display_name(), ''))
    );
$$;

create or replace function public.can_access_all_republish_queue()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.app_settings s
      where s.key = 'assignments'
        and s.value->>'republish_queue_super_user' = public.current_display_name()
    );
$$;

-- ---------------------------------------------------------------------------
-- Profiles: force User on signup; block self role/active escalation
-- ---------------------------------------------------------------------------

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

  -- Never honor client-supplied Admin (or other) role on signup
  insert into public.profiles (id, display_name, role, mobile_number, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'User',
    new.raw_user_meta_data->>'mobile_number',
    true
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
  if public.is_admin() then
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

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.profiles_prevent_privilege_escalation();

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin_or_self_user
  on public.profiles for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and role = 'User'
    )
  );

-- Keep update policy; trigger enforces role/active immutability for non-admins

-- ---------------------------------------------------------------------------
-- Properties: staff-only table SELECT; public via redacted view only
-- ---------------------------------------------------------------------------

drop policy if exists properties_select_public_active on public.properties;
drop policy if exists properties_select_staff on public.properties;

create policy properties_select_staff
  on public.properties for select
  to authenticated
  using (public.is_staff());

drop view if exists public.property_public_cards;
-- Definer view (no security_invoker): exposes only non-contact columns to anon
create view public.property_public_cards as
select
  p.id,
  p.ref_no,
  p.ref_seq,
  p.created_at,
  p.opportunity_type,
  p.property_type,
  p.city,
  p.address,
  p.status,
  p.currency,
  p.price_total,
  p.budget,
  p.land_size_perch,
  p.floor_area_sqft,
  p.bedrooms,
  p.bathrooms,
  p.view,
  p.amenities,
  p.comments,
  p.do_not_publish
from public.properties p
where p.status = 'Active' and p.do_not_publish = false;

alter view public.property_public_cards set (security_invoker = false);

revoke all on public.property_public_cards from public;
grant select on public.property_public_cards to anon, authenticated;

-- Media: staff full; public Active non-DNP for authenticated (no anon media yet)
drop policy if exists property_media_select on public.property_media;
create policy property_media_select
  on public.property_media for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.status = 'Active'
        and p.do_not_publish = false
    )
  );

-- ---------------------------------------------------------------------------
-- Partner users: no open anon insert
-- ---------------------------------------------------------------------------

drop policy if exists users_insert_anon_signup on public.users;
create policy users_insert_self_pending
  on public.users for insert
  to authenticated
  with check (
    status = 'Pending'
    and active = false
    and auth_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Queues: allow-list / ownership in RLS
-- ---------------------------------------------------------------------------

drop policy if exists republish_select_staff on public.republish_queue;
drop policy if exists republish_write_staff on public.republish_queue;

create policy republish_select_scoped
  on public.republish_queue for select
  to authenticated
  using (
    public.can_access_all_republish_queue()
    or user_name = public.current_display_name()
  );

create policy republish_insert_staff
  on public.republish_queue for insert
  to authenticated
  with check (
    public.is_staff()
    and (
      public.can_access_all_republish_queue()
      or user_name = public.current_display_name()
    )
  );

create policy republish_update_scoped
  on public.republish_queue for update
  to authenticated
  using (
    public.can_access_all_republish_queue()
    or user_name = public.current_display_name()
  )
  with check (
    public.can_access_all_republish_queue()
    or user_name = public.current_display_name()
  );

create policy republish_delete_scoped
  on public.republish_queue for delete
  to authenticated
  using (
    public.can_access_all_republish_queue()
    or user_name = public.current_display_name()
  );

drop policy if exists smq_select_staff on public.social_media_queue;
drop policy if exists smq_write_staff on public.social_media_queue;

create policy smq_select_allow_list
  on public.social_media_queue for select
  to authenticated
  using (public.can_access_social_media_queue());

-- Staff may enqueue via status workflows; operators/admins manage rows
create policy smq_insert_staff
  on public.social_media_queue for insert
  to authenticated
  with check (public.is_staff());

create policy smq_update_allow_list
  on public.social_media_queue for update
  to authenticated
  using (public.can_access_social_media_queue())
  with check (public.can_access_social_media_queue());

create policy smq_delete_allow_list
  on public.social_media_queue for delete
  to authenticated
  using (public.can_access_social_media_queue());

-- ---------------------------------------------------------------------------
-- RPCs: staff only
-- ---------------------------------------------------------------------------

create or replace function public.next_property_ref()
returns table (ref_no text, ref_seq integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;
  select coalesce(max(p.ref_seq), 0) + 1 into v_seq from public.properties p;
  return query select ('C7-' || v_seq::text), v_seq;
end;
$$;

create or replace function public.dashboard_listing_counts(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_created_by_name text default null
)
returns table (
  status public.listing_status,
  property_type public.property_type,
  cnt bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;
  return query
  select p.status, p.property_type, count(*)::bigint
  from public.properties p
  where (p_from is null or p.created_at >= p_from)
    and (p_to is null or p.created_at < p_to)
    and (p_created_by_name is null or p.created_by_name = p_created_by_name)
  group by p.status, p.property_type;
end;
$$;

revoke all on function public.next_property_ref() from public;
revoke all on function public.dashboard_listing_counts(timestamptz, timestamptz, text) from public;
grant execute on function public.next_property_ref() to authenticated;
grant execute on function public.dashboard_listing_counts(timestamptz, timestamptz, text) to authenticated;

grant execute on function public.current_display_name() to authenticated;
grant execute on function public.can_access_social_media_queue() to authenticated;
grant execute on function public.can_access_all_republish_queue() to authenticated;
