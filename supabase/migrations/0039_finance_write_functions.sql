-- Finance phase 2: create / edit / void invoices, record payments, manage
-- agents and yearly targets from the app. All writes go through these
-- admin-checked functions (the finance schema is not exposed over REST).

alter table finance.invoices
  add column if not exists updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_by_name text,
  add column if not exists void_reason text,
  add column if not exists voided_by_name text;

create or replace function finance.actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select display_name from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
create or replace function public.finance_get_invoice(p_id uuid)
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

  select to_jsonb(b) || jsonb_build_object(
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'paid_on', p.paid_on, 'amount', p.amount, 'reference', p.reference,
        'notes', p.notes, 'created_by_name', p.created_by_name, 'created_at', p.created_at
      ) order by p.paid_on nulls first, p.created_at)
      from finance.payments p where p.invoice_id = b.id
    ), '[]'::jsonb),
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object('agent_id', a.id, 'name', a.name, 'amount', ia.amount) order by ia.amount desc)
      from finance.invoice_agents ia join finance.agents a on a.id = ia.agent_id
      where ia.invoice_id = b.id
    ), '[]'::jsonb)
  )
  into v
  from finance.invoice_balances b
  where b.id = p_id;

  return v;
end;
$$;

create or replace function public.finance_next_invoice_no(p_date date)
returns text
language plpgsql
stable
security definer
set search_path = public, finance
as $$
declare
  y text := extract(year from coalesce(p_date, current_date))::int::text;
  n int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  select coalesce(max(substring(invoice_no from '^C' || y || '(\d{3})')::int), 0) + 1
  into n
  from finance.invoices
  where invoice_no ~ ('^C' || y || '\d{3}');
  return 'C' || y || lpad(n::text, 3, '0') || 'L';
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
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'sales_agent', a.sales_agent, 'active', a.active,
      'profile_id', a.profile_id, 'profile_name', p.display_name,
      'invoices', (select count(*) from finance.invoice_agents ia where ia.agent_id = a.id)
    ) order by a.active desc, a.name)
    from finance.agents a
    left join public.profiles p on p.id = a.profile_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.finance_targets(p_year integer)
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
    select jsonb_agg(jsonb_build_object(
      'agent_id', a.id, 'name', a.name, 'active', a.active,
      'target', t.target, 'previous_target', tp.target,
      'achieved', coalesce((
        select sum(ia.amount)
        from finance.invoice_agents ia
        join finance.invoices i on i.id = ia.invoice_id
        where ia.agent_id = a.id and i.voided_at is null
          and extract(year from i.invoice_date)::int = p_year
      ), 0)
    ) order by a.name)
    from finance.agents a
    left join finance.agent_targets t on t.agent_id = a.id and t.year = p_year
    left join finance.agent_targets tp on tp.agent_id = a.id and tp.year = p_year - 1
    where a.sales_agent and (a.active or t.target is not null)
  ), '[]'::jsonb);
end;
$$;

-- Same signature as 0038; adds p_status = 'void' and voided_at to the rows.
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
      b.property_ref, b.voided_at,
      (
        select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'amount', ia.amount) order by ia.amount desc), '[]'::jsonb)
        from finance.invoice_agents ia
        join finance.agents a on a.id = ia.agent_id
        where ia.invoice_id = b.id
      ) as agents
    from finance.invoice_balances b
    where (case when p_status = 'void' then b.voided_at is not null else b.voided_at is null end)
      and b.invoice_date between p_from and p_to
      and (p_type is null or b.revenue_type = p_type)
      and (
        p_status is null or p_status = 'void'
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

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
-- p_data: invoice_no, invoice_date, sent_date, customer_name, details, category,
--         revenue_type, amount, c7_booking, revenue_month, property_ref, notes
-- p_agents: [{ agent_id, amount }]
create or replace function public.finance_save_invoice(
  p_id uuid,
  p_data jsonb,
  p_agents jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, finance
as $$
declare
  v_id uuid := p_id;
  v_amount numeric := coalesce((p_data->>'amount')::numeric, 0);
  v_ref text := nullif(upper(trim(coalesce(p_data->>'property_ref', ''))), '');
  v_paid numeric;
  v_name text := finance.actor_name();
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if nullif(trim(coalesce(p_data->>'invoice_no', '')), '') is null then
    raise exception 'Invoice number is required';
  end if;
  if nullif(p_data->>'invoice_date', '') is null then
    raise exception 'Invoice date is required';
  end if;
  if v_amount < 0 then
    raise exception 'Amount can''t be negative';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_agents, '[]'::jsonb)) e
    where coalesce((e->>'amount')::numeric, 0) < 0
  ) then
    raise exception 'Agent amounts can''t be negative';
  end if;

  if v_id is null then
    insert into finance.invoices (
      invoice_no, invoice_date, sent_date, customer_name, details, category, revenue_type,
      amount, c7_booking, revenue_month, property_ref, property_id, notes,
      created_by, created_by_name
    )
    values (
      trim(p_data->>'invoice_no'),
      (p_data->>'invoice_date')::date,
      nullif(p_data->>'sent_date', '')::date,
      nullif(trim(coalesce(p_data->>'customer_name', '')), ''),
      coalesce(trim(p_data->>'details'), ''),
      p_data->>'category',
      p_data->>'revenue_type',
      v_amount,
      nullif(p_data->>'c7_booking', '')::numeric,
      nullif(p_data->>'revenue_month', '')::date,
      v_ref,
      (select id from public.properties where ref_no = v_ref),
      nullif(trim(coalesce(p_data->>'notes', '')), ''),
      auth.uid(),
      v_name
    )
    returning id into v_id;
  else
    select coalesce(sum(amount), 0) into v_paid from finance.payments where invoice_id = v_id;
    if v_amount < v_paid then
      raise exception 'Amount can''t be less than the % already received', to_char(v_paid, 'FM999,999,999,990.00');
    end if;
    update finance.invoices set
      invoice_no = trim(p_data->>'invoice_no'),
      invoice_date = (p_data->>'invoice_date')::date,
      sent_date = nullif(p_data->>'sent_date', '')::date,
      customer_name = nullif(trim(coalesce(p_data->>'customer_name', '')), ''),
      details = coalesce(trim(p_data->>'details'), ''),
      category = p_data->>'category',
      revenue_type = p_data->>'revenue_type',
      amount = v_amount,
      c7_booking = nullif(p_data->>'c7_booking', '')::numeric,
      revenue_month = nullif(p_data->>'revenue_month', '')::date,
      property_ref = v_ref,
      property_id = (select id from public.properties where ref_no = v_ref),
      notes = nullif(trim(coalesce(p_data->>'notes', '')), ''),
      updated_by = auth.uid(),
      updated_by_name = v_name
    where id = v_id;
    if not found then
      raise exception 'Invoice not found';
    end if;
  end if;

  delete from finance.invoice_agents where invoice_id = v_id;
  insert into finance.invoice_agents (invoice_id, agent_id, amount)
  select v_id, (e->>'agent_id')::uuid, sum(coalesce((e->>'amount')::numeric, 0))
  from jsonb_array_elements(coalesce(p_agents, '[]'::jsonb)) e
  where nullif(e->>'agent_id', '') is not null
  group by (e->>'agent_id')::uuid;

  return v_id;
exception
  when unique_violation then
    raise exception 'Invoice number % already exists', trim(p_data->>'invoice_no');
end;
$$;

create or replace function public.finance_void_invoice(p_id uuid, p_void boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, finance
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update finance.invoices set
    voided_at = case when p_void then now() else null end,
    voided_by_name = case when p_void then finance.actor_name() else null end,
    void_reason = case when p_void then nullif(trim(coalesce(p_reason, '')), '') else null end,
    updated_by = auth.uid(),
    updated_by_name = finance.actor_name()
  where id = p_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create or replace function public.finance_add_payment(
  p_invoice_id uuid,
  p_paid_on date,
  p_amount numeric,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, finance
as $$
declare
  v_id uuid;
  v_outstanding numeric;
  v_voided timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  select outstanding, voided_at into v_outstanding, v_voided
  from finance.invoice_balances where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_voided is not null then
    raise exception 'This invoice is void';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Payment amount must be more than 0';
  end if;
  if p_amount > v_outstanding + 0.005 then
    raise exception 'Payment is more than the % outstanding', to_char(v_outstanding, 'FM999,999,999,990.00');
  end if;

  insert into finance.payments (invoice_id, paid_on, amount, reference, notes, created_by, created_by_name)
  values (
    p_invoice_id, p_paid_on, p_amount,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid(), finance.actor_name()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finance_delete_payment(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, finance
as $$
declare
  v_invoice uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from finance.payments where id = p_id returning invoice_id into v_invoice;
  if v_invoice is null then
    raise exception 'Payment not found';
  end if;
  update finance.invoices
  set updated_by = auth.uid(), updated_by_name = finance.actor_name(), updated_at = now()
  where id = v_invoice;
  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agents & targets
-- ---------------------------------------------------------------------------
create or replace function public.finance_save_agent(
  p_id uuid,
  p_name text,
  p_profile_id uuid,
  p_sales_agent boolean,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, finance
as $$
declare
  v_id uuid := p_id;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if v_name is null then
    raise exception 'Agent name is required';
  end if;
  if v_id is null then
    insert into finance.agents (name, profile_id, sales_agent, active)
    values (v_name, p_profile_id, coalesce(p_sales_agent, true), coalesce(p_active, true))
    returning id into v_id;
  else
    update finance.agents set
      name = v_name, profile_id = p_profile_id,
      sales_agent = coalesce(p_sales_agent, sales_agent),
      active = coalesce(p_active, active)
    where id = v_id;
    if not found then
      raise exception 'Agent not found';
    end if;
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'An agent called % already exists', v_name;
end;
$$;

create or replace function public.finance_set_target(p_agent_id uuid, p_year integer, p_target numeric)
returns void
language plpgsql
security definer
set search_path = public, finance
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_target is null then
    delete from finance.agent_targets where agent_id = p_agent_id and year = p_year;
  elsif p_target < 0 then
    raise exception 'Target can''t be negative';
  else
    insert into finance.agent_targets (agent_id, year, target)
    values (p_agent_id, p_year, p_target)
    on conflict (agent_id, year) do update set target = excluded.target;
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.finance_get_invoice(uuid)',
    'public.finance_next_invoice_no(date)',
    'public.finance_agents()',
    'public.finance_targets(integer)',
    'public.finance_invoice_list(date, date, uuid, text, text, text, integer)',
    'public.finance_save_invoice(uuid, jsonb, jsonb)',
    'public.finance_void_invoice(uuid, boolean, text)',
    'public.finance_add_payment(uuid, date, numeric, text, text)',
    'public.finance_delete_payment(uuid)',
    'public.finance_save_agent(uuid, text, uuid, boolean, boolean)',
    'public.finance_set_target(uuid, integer, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on function finance.actor_name() from public, anon;
