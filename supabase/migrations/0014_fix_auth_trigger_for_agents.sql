-- Fix auth signup trigger: only create profiles for staff roles (Admin/User).
-- Partner Agents must not get a profiles row (Agent is not staff_role).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  staff_role public.staff_role;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'User');

  -- Skip profile creation for partner agents / non-staff
  if meta_role = 'Agent' then
    return new;
  end if;

  begin
    staff_role := meta_role::public.staff_role;
  exception when others then
    staff_role := 'User';
  end;

  insert into public.profiles (id, display_name, role, mobile_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    staff_role,
    new.raw_user_meta_data->>'mobile_number'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
