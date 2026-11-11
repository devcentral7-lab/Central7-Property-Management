-- Allow listing owners to match Ikman items by display name even when owner_id is set
-- (covers renames / legacy rows where id and name can disagree).

drop policy if exists ikman_republish_items_owner_select on public.ikman_republish_items;
create policy ikman_republish_items_owner_select
  on public.ikman_republish_items for select
  to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or (
      owner_name is not null
      and owner_name = public.current_display_name()
    )
  );

drop policy if exists ikman_republish_items_owner_decide on public.ikman_republish_items;
create policy ikman_republish_items_owner_decide
  on public.ikman_republish_items for update
  to authenticated
  using (
    status = 'pending_owner'
    and (
      owner_id = auth.uid()
      or (
        owner_name is not null
        and owner_name = public.current_display_name()
      )
    )
  )
  with check (
    status in ('approved_by_owner', 'declined_by_owner')
    and (
      owner_id = auth.uid()
      or (
        owner_name is not null
        and owner_name = public.current_display_name()
      )
    )
  );
