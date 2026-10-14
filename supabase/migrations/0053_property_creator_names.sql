-- Options for the "User" search filter. Includes creators from the legacy system
-- who never got a profile. Security invoker, so properties RLS still applies.

create or replace function public.property_creator_names()
returns setof text
language sql
stable
set search_path = public
as $$
  select distinct trim(p.created_by_name)
  from public.properties p
  where nullif(trim(p.created_by_name), '') is not null
  order by 1;
$$;

revoke all on function public.property_creator_names() from public, anon;
grant execute on function public.property_creator_names() to authenticated;
