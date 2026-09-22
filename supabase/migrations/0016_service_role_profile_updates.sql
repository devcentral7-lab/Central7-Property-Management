-- Allow service-role / system profile updates (auth.uid() is null) so Admin
-- onboarding can set role/active after auth.users insert. Authenticated
-- non-admins still cannot escalate.

create or replace function public.profiles_prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / SQL scripts: no JWT user
  if auth.uid() is null then
    return new;
  end if;

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
