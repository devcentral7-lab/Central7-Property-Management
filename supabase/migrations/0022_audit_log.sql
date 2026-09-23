-- System-wide audit trail (logins, CRUD, settings) for Admin Activity log.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  category text not null,
  action text not null,
  actor_id uuid,
  actor_name text,
  actor_kind text not null default 'unknown',
  subject_type text,
  subject_id text,
  subject_label text,
  summary text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text
);

create index if not exists audit_log_occurred_at_idx
  on public.audit_log (occurred_at desc);
create index if not exists audit_log_category_idx
  on public.audit_log (category, occurred_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, occurred_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log for select
  using (public.is_admin());

-- Authenticated callers insert via RPC (not direct table insert from client).
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
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'category required';
  end if;
  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'action required';
  end if;

  v_kind := coalesce(
    nullif(trim(p_actor_kind), ''),
    case
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
  if v_name is null then
    select p.display_name into v_name
    from public.profiles p where p.id = v_uid;
  end if;
  if v_name is null then
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
  text, text, text, text, text, text, text, text, jsonb, text, text
) from public;
grant execute on function public.log_audit_event(
  text, text, text, text, text, text, text, text, jsonb, text, text
) to authenticated;
