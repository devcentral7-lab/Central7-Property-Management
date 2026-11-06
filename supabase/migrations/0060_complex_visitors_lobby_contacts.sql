-- Replace Guard Room with Visitors Lobby; add contact person names on complexes.
alter table public.apartment_complexes
  add column if not exists visitors_lobby text,
  add column if not exists contact_person_1 text,
  add column if not exists contact_person_2 text;

update public.apartment_complexes
set visitors_lobby = guard_room
where visitors_lobby is null
  and guard_room is not null
  and btrim(guard_room) <> '';
