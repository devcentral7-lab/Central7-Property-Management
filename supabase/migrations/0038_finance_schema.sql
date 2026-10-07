-- Finance: invoices, payments, agent commission splits and yearly targets
-- (replaces the "INVOICE Tracker" workbook).
--
-- Lives in its own `finance` schema so nothing in `public` changes. The schema
-- is not exposed through the REST API; the app reads it through the
-- admin-checked public.finance_* functions below.

create schema if not exists finance;

revoke all on schema finance from public, anon;
grant usage on schema finance to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Agents (staff and past agents who earn commission; not every agent has a
-- login, e.g. Prem).
-- ---------------------------------------------------------------------------
create table if not exists finance.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  profile_id uuid references public.profiles (id) on delete set null,
  -- Sales agents get targets and appear on the quarterly performance chart.
  sales_agent boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table if not exists finance.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  invoice_date date not null,
  due_date date,
  sent_date date,
  customer_name text,
  details text not null default '',
  category text not null
    check (category in ('C7 Brokering', 'C7 Management', 'Car Park', 'Other')),
  revenue_type text not null
    check (revenue_type in ('Sale', 'Rental', 'Management Fee', 'Car Park', 'Other')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  -- Revenue C7 books from this invoice (the workbook's "C7 Booking").
  c7_booking numeric(14, 2),
  revenue_month date,
  property_ref text,
  property_id uuid references public.properties (id) on delete set null,
  notes text,
  voided_at timestamptz,
  legacy_sheet text,
  legacy_row integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_invoices_date_idx on finance.invoices (invoice_date desc);
create index if not exists finance_invoices_category_idx on finance.invoices (category, revenue_type);
create index if not exists finance_invoices_property_idx on finance.invoices (property_id)
  where property_id is not null;

-- ---------------------------------------------------------------------------
-- Payments (an invoice can be paid in parts)
-- ---------------------------------------------------------------------------
create table if not exists finance.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoices (id) on delete cascade,
  paid_on date,
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists finance_payments_invoice_idx on finance.payments (invoice_id);
create index if not exists finance_payments_paid_on_idx on finance.payments (paid_on desc);

-- ---------------------------------------------------------------------------
-- Commission split: how much of each invoice is credited to which agent
-- ---------------------------------------------------------------------------
create table if not exists finance.invoice_agents (
  invoice_id uuid not null references finance.invoices (id) on delete cascade,
  agent_id uuid not null references finance.agents (id) on delete restrict,
  amount numeric(14, 2) not null check (amount >= 0),
  primary key (invoice_id, agent_id)
);

create index if not exists finance_invoice_agents_agent_idx on finance.invoice_agents (agent_id);

-- ---------------------------------------------------------------------------
-- Yearly targets per agent
-- ---------------------------------------------------------------------------
create table if not exists finance.agent_targets (
  agent_id uuid not null references finance.agents (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  target numeric(14, 2) not null check (target >= 0),
  primary key (agent_id, year)
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists finance_agents_set_updated_at on finance.agents;
create trigger finance_agents_set_updated_at
before update on finance.agents
for each row execute function public.set_updated_at();

drop trigger if exists finance_invoices_set_updated_at on finance.invoices;
create trigger finance_invoices_set_updated_at
before update on finance.invoices
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------
create or replace view finance.invoice_balances
with (security_invoker = true) as
select
  i.*,
  coalesce(p.paid, 0)::numeric(14, 2) as paid,
  greatest(i.amount - coalesce(p.paid, 0), 0)::numeric(14, 2) as outstanding,
  p.last_paid_on
from finance.invoices i
left join (
  select invoice_id, sum(amount) as paid, max(paid_on) as last_paid_on
  from finance.payments
  group by invoice_id
) p on p.invoice_id = i.id;

-- ---------------------------------------------------------------------------
-- RLS: admins only
-- ---------------------------------------------------------------------------
alter table finance.agents enable row level security;
alter table finance.invoices enable row level security;
alter table finance.payments enable row level security;
alter table finance.invoice_agents enable row level security;
alter table finance.agent_targets enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['agents', 'invoices', 'payments', 'invoice_agents', 'agent_targets'] loop
    execute format('drop policy if exists %I on finance.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on finance.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end;
$$;

revoke all on all tables in schema finance from public, anon;
grant select, insert, update, delete on all tables in schema finance to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dashboard: everything the Finance page needs in one call.
--   p_from / p_to: invoice date range [p_from, p_to]
--   p_year: year for targets and the quarterly chart
--   p_agent: only invoices credited to this agent
-- ---------------------------------------------------------------------------
create or replace function public.finance_dashboard(
  p_from date,
  p_to date,
  p_year integer,
  p_agent uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, finance
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with inv as (
    select b.*
    from finance.invoice_balances b
    where b.voided_at is null
      and b.invoice_date between p_from and p_to
      and (
        p_agent is null
        or exists (
          select 1 from finance.invoice_agents ia
          where ia.invoice_id = b.id and ia.agent_id = p_agent
        )
      )
  ),
  credits as (
    select ia.agent_id, i.id as invoice_id, i.revenue_type, ia.amount
    from inv i
    join finance.invoice_agents ia on ia.invoice_id = i.id
    where p_agent is null or ia.agent_id = p_agent
  ),
  agent_rows as (
    select
      a.id,
      a.name,
      a.sales_agent,
      count(distinct c.invoice_id) as invoices,
      coalesce(sum(c.amount) filter (where c.revenue_type = 'Sale'), 0) as sale,
      coalesce(sum(c.amount) filter (where c.revenue_type = 'Rental'), 0) as rental,
      coalesce(sum(c.amount) filter (where c.revenue_type not in ('Sale', 'Rental')), 0) as other,
      coalesce(sum(c.amount), 0) as total,
      t.target
    from finance.agents a
    left join credits c on c.agent_id = a.id
    left join finance.agent_targets t on t.agent_id = a.id and t.year = p_year
    where (p_agent is null or a.id = p_agent)
    group by a.id, a.name, a.sales_agent, t.target
    having count(c.invoice_id) > 0 or t.target is not null
  )
  select jsonb_build_object(
    'invoice_count', (select count(*) from inv),
    'totals', (
      select jsonb_build_object(
        'invoiced', coalesce(sum(amount), 0),
        'received', coalesce(sum(paid), 0),
        'outstanding', coalesce(sum(outstanding), 0)
      )
      from inv
    ),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', t.type, 'count', coalesce(x.cnt, 0), 'amount', coalesce(x.amt, 0)) order by t.ord)
      from (values ('Sale', 1), ('Rental', 2), ('Management Fee', 3), ('Car Park', 4), ('Other', 5)) as t(type, ord)
      left join (
        select revenue_type, count(*) as cnt, sum(amount) as amt from inv group by revenue_type
      ) x on x.revenue_type = t.type
    ), '[]'::jsonb),
    'by_agent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'sales_agent', sales_agent, 'invoices', invoices,
        'sale', sale, 'rental', rental, 'other', other, 'total', total, 'target', target
      ) order by sales_agent, total desc)
      from agent_rows
    ), '[]'::jsonb),
    'by_category_year', coalesce((
      select jsonb_agg(jsonb_build_object('year', y, 'category', category, 'amount', amt) order by y desc, category)
      from (
        select extract(year from invoice_date)::int as y, category, sum(amount) as amt
        from finance.invoices
        where voided_at is null
          and (
            p_agent is null
            or exists (
              select 1 from finance.invoice_agents ia
              where ia.invoice_id = invoices.id and ia.agent_id = p_agent
            )
          )
        group by 1, 2
      ) s
    ), '[]'::jsonb),
    'quarterly', coalesce((
      select jsonb_agg(jsonb_build_object('agent', name, 'quarter', q, 'amount', amt) order by name, q)
      from (
        select a.name, extract(quarter from i.invoice_date)::int as q, sum(ia.amount) as amt
        from finance.invoice_agents ia
        join finance.invoices i on i.id = ia.invoice_id
        join finance.agents a on a.id = ia.agent_id
        where i.voided_at is null
          and a.sales_agent
          and extract(year from i.invoice_date)::int = p_year
          and (p_agent is null or a.id = p_agent)
        group by 1, 2
      ) s
    ), '[]'::jsonb)
  )
  into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoice list for the Finance page
-- ---------------------------------------------------------------------------
create or replace function public.finance_invoice_list(
  p_from date,
  p_to date,
  p_agent uuid default null,
  p_type text default null,
  p_status text default null,
  p_q text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, finance
as $$
declare
  v jsonb;
  q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.invoice_date desc, r.invoice_no desc), '[]'::jsonb)
  into v
  from (
    select
      b.id, b.invoice_no, b.invoice_date, b.sent_date, b.customer_name, b.details,
      b.category, b.revenue_type, b.amount, b.paid, b.outstanding, b.last_paid_on,
      b.property_ref,
      (
        select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'amount', ia.amount) order by ia.amount desc), '[]'::jsonb)
        from finance.invoice_agents ia
        join finance.agents a on a.id = ia.agent_id
        where ia.invoice_id = b.id
      ) as agents
    from finance.invoice_balances b
    where b.voided_at is null
      and b.invoice_date between p_from and p_to
      and (p_type is null or b.revenue_type = p_type)
      and (
        p_status is null
        or (p_status = 'paid' and b.outstanding = 0)
        or (p_status = 'outstanding' and b.outstanding > 0)
      )
      and (
        p_agent is null
        or exists (
          select 1 from finance.invoice_agents ia
          where ia.invoice_id = b.id and ia.agent_id = p_agent
        )
      )
      and (
        q is null
        or b.invoice_no ilike '%' || q || '%'
        or b.customer_name ilike '%' || q || '%'
        or b.details ilike '%' || q || '%'
        or b.property_ref ilike '%' || q || '%'
      )
    order by b.invoice_date desc, b.invoice_no desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
  ) r;

  return v;
end;
$$;

create or replace function public.finance_agents()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, finance
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'sales_agent', sales_agent, 'active', active) order by name)
    from finance.agents
  ), '[]'::jsonb);
end;
$$;

create or replace function public.finance_years()
returns integer[]
language plpgsql
stable
security definer
set search_path = public, finance
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return coalesce((
    select array_agg(y order by y desc)
    from (select distinct extract(year from invoice_date)::int as y from finance.invoices) s
  ), array[]::integer[]);
end;
$$;

revoke all on function public.finance_dashboard(date, date, integer, uuid) from public, anon;
revoke all on function public.finance_invoice_list(date, date, uuid, text, text, text, integer) from public, anon;
revoke all on function public.finance_agents() from public, anon;
revoke all on function public.finance_years() from public, anon;
grant execute on function public.finance_dashboard(date, date, integer, uuid) to authenticated;
grant execute on function public.finance_invoice_list(date, date, uuid, text, text, text, integer) to authenticated;
grant execute on function public.finance_agents() to authenticated;
grant execute on function public.finance_years() to authenticated;
