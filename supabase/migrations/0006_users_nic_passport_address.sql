-- users: add NIC / passport; rename registered_address → address
alter table public.users rename column registered_address to address;
alter table public.users add column if not exists nic text;
alter table public.users add column if not exists passport_number text;
