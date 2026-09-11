-- Rename partner table agents → users (legacy "Agents"; staff remain in profiles)
-- Note: public.users is separate from auth.users

alter table if exists public.agents rename to users;

alter index if exists agents_status_idx rename to users_status_idx;
alter index if exists agents_active_idx rename to users_active_idx;

drop trigger if exists agents_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop policy if exists agents_select_admin_or_self on public.users;
drop policy if exists agents_insert_anon_signup on public.users;
drop policy if exists agents_update_admin on public.users;

create policy users_select_admin_or_self
  on public.users for select
  to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());

create policy users_insert_anon_signup
  on public.users for insert
  to anon, authenticated
  with check (status = 'Pending' and active = false);

create policy users_update_admin
  on public.users for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
