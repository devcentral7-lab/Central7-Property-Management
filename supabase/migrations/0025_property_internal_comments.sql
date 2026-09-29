-- Staff-only notes on a listing. Readable only through the staff RLS policy on
-- public.properties; deliberately NOT part of property_public_cards, so it
-- never reaches the public page or anon clients.

alter table public.properties
  add column if not exists internal_comments text;

comment on column public.properties.internal_comments is
  'Staff-only notes. Never exposed via property_public_cards or social posts.';
