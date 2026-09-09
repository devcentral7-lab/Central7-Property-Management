-- Row Level Security for Central7 Pulse
-- Browser uses anon key + user JWT. Service role bypasses RLS (server only).

alter table public.cities enable row level security;
alter table public.apartment_complexes enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.properties enable row level security;
alter table public.property_media enable row level security;
alter table public.property_status_events enable row level security;
alter table public.republish_queue enable row level security;
alter table public.social_media_queue enable row level security;
alter table public.messages enable row level security;
alter table public.inquiries enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using (public.is_staff() or id = auth.uid());

create policy profiles_update_self_or_admin
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_admin() or id = auth.uid());

-- ---------------------------------------------------------------------------
-- cities / apartment_complexes — staff read; admin write
-- ---------------------------------------------------------------------------

create policy cities_select_authenticated
  on public.cities for select
  to authenticated
  using (true);

create policy cities_write_admin
  on public.cities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy complexes_select_authenticated
  on public.apartment_complexes for select
  to authenticated
  using (true);

create policy complexes_write_admin
  on public.apartment_complexes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- agents — admin manage; agent can read own row
-- ---------------------------------------------------------------------------

create policy agents_select_admin_or_self
  on public.agents for select
  to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());

create policy agents_insert_anon_signup
  on public.agents for insert
  to anon, authenticated
  with check (status = 'Pending' and active = false);

create policy agents_update_admin
  on public.agents for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- properties — staff full access; authenticated agents/guests: read Active only via API
-- Prefer API redaction; RLS allows staff all rows, agents only non-DNP Active.
-- ---------------------------------------------------------------------------

create policy properties_select_staff
  on public.properties for select
  to authenticated
  using (
    public.is_staff()
    or (
      status = 'Active'
      and do_not_publish = false
    )
  );

create policy properties_insert_staff
  on public.properties for insert
  to authenticated
  with check (public.is_staff());

create policy properties_update_staff
  on public.properties for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy properties_delete_admin
  on public.properties for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- property_media
-- ---------------------------------------------------------------------------

create policy property_media_select
  on public.property_media for select
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (
          public.is_staff()
          or (p.status = 'Active' and p.do_not_publish = false)
        )
    )
  );

create policy property_media_write_staff
  on public.property_media for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- property_status_events — staff only
-- ---------------------------------------------------------------------------

create policy status_events_select_staff
  on public.property_status_events for select
  to authenticated
  using (public.is_staff());

create policy status_events_insert_staff
  on public.property_status_events for insert
  to authenticated
  with check (public.is_staff());

create policy status_events_update_staff
  on public.property_status_events for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- republish_queue — staff; non-admins see own user_name (enforced also in API)
-- ---------------------------------------------------------------------------

create policy republish_select_staff
  on public.republish_queue for select
  to authenticated
  using (public.is_staff());

create policy republish_write_staff
  on public.republish_queue for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- social_media_queue — admin or allow-list enforced in API; RLS = staff for now
-- ---------------------------------------------------------------------------

create policy smq_select_staff
  on public.social_media_queue for select
  to authenticated
  using (public.is_staff());

create policy smq_write_staff
  on public.social_media_queue for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create policy messages_select_involved
  on public.messages for select
  to authenticated
  using (
    public.is_admin()
    or from_name = (select display_name from public.profiles where id = auth.uid())
    or to_name = (select display_name from public.profiles where id = auth.uid())
    or to_name = 'All'
  );

create policy messages_insert_staff
  on public.messages for insert
  to authenticated
  with check (public.is_staff());

create policy messages_update_staff
  on public.messages for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy messages_delete_admin_or_own
  on public.messages for delete
  to authenticated
  using (
    public.is_admin()
    or from_name = (select display_name from public.profiles where id = auth.uid())
    or to_name = (select display_name from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- inquiries — staff
-- ---------------------------------------------------------------------------

create policy inquiries_select_staff
  on public.inquiries for select
  to authenticated
  using (public.is_staff());

create policy inquiries_write_staff
  on public.inquiries for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- app_settings — staff read; admin write
-- ---------------------------------------------------------------------------

create policy app_settings_select_staff
  on public.app_settings for select
  to authenticated
  using (public.is_staff());

create policy app_settings_write_admin
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants for authenticated role
grant usage on schema public to authenticated, anon;
grant select on public.property_list_cards to authenticated;
grant execute on function public.next_property_ref() to authenticated;
grant execute on function public.dashboard_listing_counts(timestamptz, timestamptz, text) to authenticated;
