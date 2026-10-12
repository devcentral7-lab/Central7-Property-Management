-- Listings are never deleted; use a status (Drop, Lost, Closed, Obsolete) instead.
-- With no delete policy, RLS rejects deletes from every signed-in user, Admin included.
drop policy if exists properties_delete_admin on public.properties;
