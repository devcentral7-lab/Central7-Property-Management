-- Social media queue two-step flow:
--   pending approval  (approved_at null, completed_at null)  -> Activity log
--   pending publish   (approved_at set,  completed_at null)  -> SMQ "Pending" tab
--   published         (approved_at set,  completed_at set)   -> SMQ "Published" tab
-- Plus indexes for the queue tabs and the My Properties table.

-- Legacy rows marked published without an approval timestamp would otherwise
-- vanish from every tab (the Published tab requires approved_at).
update public.social_media_queue
set approved_at = completed_at
where completed_at is not null
  and approved_at is null;

alter table public.social_media_queue
  drop constraint if exists social_media_queue_publish_requires_approval;

alter table public.social_media_queue
  add constraint social_media_queue_publish_requires_approval
  check (completed_at is null or approved_at is not null);

-- Activity log "Social approvals": newest requests awaiting approval.
create index if not exists social_media_queue_awaiting_approval_idx
  on public.social_media_queue (created_at desc)
  where approved_at is null and completed_at is null;

-- SMQ "Published" tab.
create index if not exists social_media_queue_published_idx
  on public.social_media_queue (completed_at desc)
  where completed_at is not null;

-- My Properties table + "My listings" count: filter by creator, newest first.
create index if not exists properties_created_by_name_created_at_idx
  on public.properties (created_by_name, created_at desc);
