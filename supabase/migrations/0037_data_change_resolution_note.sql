-- Why a done Data Change request did (or didn't) go to the social media queue.

alter table public.property_status_events
  add column if not exists resolution_note text;

update public.property_status_events e
set resolution_note = a.details->>'social_media'
from public.audit_log a
where e.action = 'Data Change'
  and e.resolved_at is not null
  and e.resolution_note is null
  and a.action = 'data_change_done'
  and a.subject_label = e.ref_no
  and a.details->>'social_media' is not null;
