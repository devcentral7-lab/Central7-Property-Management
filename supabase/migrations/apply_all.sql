-- Central7 Pulse — optimized schema (Code.gs–aligned)
-- Apply to a NEW Supabase project. Do not run against the legacy DB in place.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (idempotent)
-- ---------------------------------------------------------------------------

do $$ begin create type public.staff_role as enum ('Admin', 'User'); exception when duplicate_object then null; end $$;
do $$ begin create type public.agent_approval_status as enum ('Pending', 'Approved', 'Rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.contact_type as enum ('Direct', 'Partner'); exception when duplicate_object then null; end $$;
do $$ begin create type public.opportunity_type as enum ('Sell', 'Rent Out'); exception when duplicate_object then null; end $$;
do $$ begin
  create type public.property_type as enum (
    'House', 'Land', 'Apartment', 'Commercial Property', 'Estate'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.listing_status as enum (
    'Active', 'Hold', 'Lost', 'Drop', 'Closed', 'Duplicate', 'Obsolete'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.furnished_status as enum (
    'Not Furnished', 'Partly Furnished', 'Fully Furnished'
  );
exception when duplicate_object then null; end $$;
do $$ begin create type public.currency_code as enum ('LKR', 'USD'); exception when duplicate_object then null; end $$;
do $$ begin create type public.social_platform as enum ('Ikman', 'LPW', 'Facebook', 'Instagram'); exception when duplicate_object then null; end $$;
do $$ begin
  create type public.activity_action as enum (
    'Publish', 'Republish', 'Drop', 'Lost', 'Hold', 'New Ad Published', 'Closed',
    'Data Change', 'Obsolete', 'Duplicate', 'Admin Edit', 'Boost Request', 'Boost Completed',
    'Published on Ikman', 'Published on LPW', 'Published on Facebook', 'Published on Instagram'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers (profile-dependent helpers are created after public.profiles)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  added_by text,
  created_at timestamptz not null default now()
);

create table public.apartment_complexes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  default_amenities text[] not null default '{}',
  added_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (staff) — auth.users holds credentials
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique,
  mobile_number text,
  role public.staff_role not null default 'User',
  photo_drive_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_active_idx on public.profiles (active);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'Admin'
  );
$$;

-- Auto-create profile row when auth user is created (optional metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, mobile_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.staff_role, 'User'),
    new.raw_user_meta_data->>'mobile_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- External partner agents
-- ---------------------------------------------------------------------------

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  company_name text,
  contact_person text,
  contact_number text,
  email text,
  registered_address text,
  username text not null unique,
  status public.agent_approval_status not null default 'Pending',
  active boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_status_idx on public.agents (status);
create index agents_active_idx on public.agents (active);

create trigger agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique,
  ref_seq integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,

  contact_type public.contact_type,
  contact_name text not null,
  contact_phone_1 text not null,
  contact_phone_2 text,
  contact_email text,

  opportunity_type public.opportunity_type not null,
  property_type public.property_type not null,
  purpose text,
  property_subtype text,
  address text,
  city_id uuid references public.cities (id) on delete set null,
  city_name text,

  land_size_perch numeric(12, 3),
  floor_area_sqft numeric(12, 2),
  bedrooms smallint,
  bathrooms smallint,
  floors smallint,
  parking_spaces smallint,
  age_years numeric(6, 1),
  apartment_complex_id uuid references public.apartment_complexes (id) on delete set null,
  apartment_floor text,

  currency public.currency_code not null default 'LKR',
  price_per_perch numeric(14, 2),
  price_per_sqft numeric(14, 2),
  price_total numeric(14, 2),
  budget numeric(14, 2),
  furnished public.furnished_status,
  status public.listing_status not null default 'Active',
  do_not_publish boolean not null default false,

  amenities text[] not null default '{}',
  comments text,
  type_attributes jsonb not null default '{}'::jsonb,
  legacy_raw jsonb,

  constraint properties_ref_no_format check (ref_no ~ '^C7-[0-9]+$'),
  constraint properties_ref_seq_positive check (ref_seq > 0)
);

create index properties_status_idx on public.properties (status);
create index properties_property_type_idx on public.properties (property_type);
create index properties_city_id_idx on public.properties (city_id);
create index properties_created_by_idx on public.properties (created_by);
create index properties_created_at_desc_idx on public.properties (created_at desc);
create index properties_opportunity_status_idx on public.properties (opportunity_type, status);
create index properties_price_total_idx on public.properties (price_total);
create index properties_contact_name_idx on public.properties (contact_name);
create index properties_city_name_idx on public.properties (city_name);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- O(1) next ref helper
create or replace function public.next_property_ref()
returns table (ref_no text, ref_seq integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  select coalesce(max(p.ref_seq), 0) + 1 into v_seq from public.properties p;
  return query select ('C7-' || v_seq::text), v_seq;
end;
$$;

-- List card view (slim DTO for paginated search — never select *)
create or replace view public.property_list_cards as
select
  p.id,
  p.ref_no,
  p.ref_seq,
  p.created_at,
  p.created_by_name,
  p.opportunity_type,
  p.property_type,
  p.city_name,
  p.status,
  p.currency,
  p.price_total,
  p.budget,
  p.land_size_perch,
  p.floor_area_sqft,
  p.bedrooms,
  p.bathrooms,
  p.do_not_publish,
  p.contact_name,
  p.contact_phone_1
from public.properties p;

-- ---------------------------------------------------------------------------
-- Property media (Drive metadata only)
-- ---------------------------------------------------------------------------

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  drive_file_id text not null,
  file_name text,
  mime_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, drive_file_id)
);

create index property_media_property_id_idx on public.property_media (property_id);

-- ---------------------------------------------------------------------------
-- Status / activity events (Status Update + Archive)
-- ---------------------------------------------------------------------------

create table public.property_status_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  ref_no text not null,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  action public.activity_action not null,
  comment text,
  requested_platforms public.social_platform[] not null default '{}',
  assigned_to text,
  boost_completed boolean not null default false,
  archived_at timestamptz,
  legacy_lpw text,
  created_at timestamptz not null default now()
);

create index property_status_events_ref_no_idx on public.property_status_events (ref_no);
create index property_status_events_property_id_idx on public.property_status_events (property_id);
create index property_status_events_occurred_at_idx on public.property_status_events (occurred_at desc);
create index property_status_events_assigned_to_idx
  on public.property_status_events (assigned_to)
  where archived_at is null;
create index property_status_events_active_idx
  on public.property_status_events (occurred_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- Queues
-- ---------------------------------------------------------------------------

create table public.republish_queue (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  ref_no text not null unique,
  user_name text,
  status text,
  action text,
  queued_at timestamptz not null default now(),
  completed_at timestamptz
);

create index republish_queue_pending_idx
  on public.republish_queue (queued_at desc)
  where completed_at is null and coalesce(status, '') = '';

create table public.social_media_queue (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  ref_no text not null unique,
  approved_action text,
  approved_by text,
  approved_at timestamptz,
  requested_platforms public.social_platform[] not null default '{}',
  platform_dates jsonb not null default '{}'::jsonb,
  comment text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_media_queue_pending_idx
  on public.social_media_queue (approved_at desc nulls last)
  where completed_at is null;

create trigger social_media_queue_set_updated_at
before update on public.social_media_queue
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid references public.profiles (id) on delete set null,
  from_name text not null,
  to_name text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  resolved boolean not null default false
);

create index messages_inbox_idx on public.messages (to_name, resolved, sent_at desc);
create index messages_from_idx on public.messages (from_name, sent_at desc);

-- ---------------------------------------------------------------------------
-- Inquiries (migrated off Sheets)
-- ---------------------------------------------------------------------------

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  logged_by uuid references public.profiles (id) on delete set null,
  logged_by_name text,
  inquiry_text text,
  contact_name text,
  contact_phone text,
  notes text,
  raw jsonb not null default '{}'::jsonb
);

create index inquiries_logged_at_idx on public.inquiries (logged_at desc);

-- ---------------------------------------------------------------------------
-- App settings (assignments, FX, amenities, allow-lists)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('assignments', jsonb_build_object(
    'new_listing_admin', 'Keerthie',
    'republish_admin', 'Keerthie',
    'data_change_admin', 'Keerthie',
    'boost_ikman_admin', 'Keerthie',
    'boost_facebook_admin', 'Sherden',
    'republish_queue_super_user', 'Sherden'
  )),
  ('social_media_queue_allow_list', '["Gokulesh"]'::jsonb),
  ('admin_overview_allow_list', '["Theeban"]'::jsonb),
  ('amenities_list', '[
    "Swimming Pool","Rooftop","Rooftop Garden","Rumpus Room (Room for games)","Gym",
    "Garden Space","Maids Room","Maids Toilet","Bar Area","Servant Quarters","Solar Panels",
    "Generator","CCTV","Lift/Elevator","Balcony","Garage","Study Room","Store Room",
    "Air Conditioning","Sea View","Water Tank"
  ]'::jsonb),
  ('usd_to_lkr', jsonb_build_object(
    'rate', 335,
    'fetched_at', null,
    'fallback_rate', 335
  )),
  ('photos_root_folder_id', '"1RJ1xTzHptaNdAfiZ3z8v1_CN_FfR6Th0"'::jsonb);

-- ---------------------------------------------------------------------------
-- Dashboard helper RPCs (aggregates only — never return full table)
-- ---------------------------------------------------------------------------

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
language sql
stable
security definer
set search_path = public
as $$
  select p.status, p.property_type, count(*)::bigint
  from public.properties p
  where (p_from is null or p.created_at >= p_from)
    and (p_to is null or p.created_at < p_to)
    and (p_created_by_name is null or p.created_by_name = p_created_by_name)
  group by p.status, p.property_type;
$$;

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
