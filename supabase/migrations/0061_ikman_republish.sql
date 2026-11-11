-- Weekly Ikman.lk expired-post republish workflow (Admin paste → owner decide → Admin complete).

do $$ begin
  create type public.ikman_republish_item_status as enum (
    'pending_owner',
    'approved_by_owner',
    'declined_by_owner',
    'republished',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.ikman_republish_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  raw_text text,
  parsed_ref_count integer not null default 0,
  enqueued_count integer not null default 0,
  skipped_count integer not null default 0,
  notes text
);

create table if not exists public.ikman_republish_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.ikman_republish_batches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ref_no text not null references public.properties (ref_no) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  owner_name text,
  status public.ikman_republish_item_status not null default 'pending_owner',
  owner_decided_at timestamptz,
  owner_note text,
  admin_completed_at timestamptz,
  admin_completed_by uuid references public.profiles (id) on delete set null,
  admin_completed_by_name text,
  suppressed_until timestamptz
);

create index if not exists ikman_republish_items_status_idx
  on public.ikman_republish_items (status, created_at desc);

create index if not exists ikman_republish_items_owner_pending_idx
  on public.ikman_republish_items (owner_id, created_at desc)
  where status = 'pending_owner';

create index if not exists ikman_republish_items_ready_idx
  on public.ikman_republish_items (created_at desc)
  where status = 'approved_by_owner';

create index if not exists ikman_republish_items_ref_idx
  on public.ikman_republish_items (ref_no, created_at desc);

-- At most one open decision cycle per listing.
create unique index if not exists ikman_republish_items_open_ref_uidx
  on public.ikman_republish_items (ref_no)
  where status in ('pending_owner', 'approved_by_owner');

drop trigger if exists ikman_republish_items_set_updated_at on public.ikman_republish_items;
create trigger ikman_republish_items_set_updated_at
  before update on public.ikman_republish_items
  for each row execute function public.set_updated_at();

alter table public.ikman_republish_batches enable row level security;
alter table public.ikman_republish_items enable row level security;

drop policy if exists ikman_republish_batches_admin_all on public.ikman_republish_batches;
create policy ikman_republish_batches_admin_all
  on public.ikman_republish_batches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ikman_republish_items_admin_all on public.ikman_republish_items;
create policy ikman_republish_items_admin_all
  on public.ikman_republish_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Owners can see their own items.
drop policy if exists ikman_republish_items_owner_select on public.ikman_republish_items;
create policy ikman_republish_items_owner_select
  on public.ikman_republish_items for select
  to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or (
      owner_id is null
      and owner_name is not null
      and owner_name = public.current_display_name()
    )
  );

-- Owners may only move their pending items to approved/declined.
drop policy if exists ikman_republish_items_owner_decide on public.ikman_republish_items;
create policy ikman_republish_items_owner_decide
  on public.ikman_republish_items for update
  to authenticated
  using (
    status = 'pending_owner'
    and (
      owner_id = auth.uid()
      or (
        owner_id is null
        and owner_name is not null
        and owner_name = public.current_display_name()
      )
    )
  )
  with check (
    status in ('approved_by_owner', 'declined_by_owner')
    and (
      owner_id = auth.uid()
      or (
        owner_id is null
        and owner_name is not null
        and owner_name = public.current_display_name()
      )
    )
  );

grant select, insert, update, delete on public.ikman_republish_batches to authenticated;
grant select, insert, update, delete on public.ikman_republish_items to authenticated;
