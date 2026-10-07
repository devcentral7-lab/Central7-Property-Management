-- Data Change requests: admins mark them done on the Activity log
-- ("Data changes" tab); done requests then go to the social media queue.

alter table public.property_status_events
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text;

create index if not exists property_status_events_open_data_change_idx
  on public.property_status_events (occurred_at desc)
  where action = 'Data Change' and resolved_at is null and archived_at is null;
