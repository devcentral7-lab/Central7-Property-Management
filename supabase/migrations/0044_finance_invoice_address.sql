-- Client address printed on the invoice PDF / Excel.

alter table finance.invoices add column if not exists customer_address text;

-- invoice_balances is i.*; a view's column list is fixed when it's created.
drop view if exists finance.invoice_balances;

create view finance.invoice_balances
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

grant select on finance.invoice_balances to authenticated, service_role;

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
      invoice_no, invoice_date, sent_date, customer_name, customer_address, details, category,
      revenue_type, amount, c7_booking, revenue_month, property_ref, property_id, notes,
      created_by, created_by_name
    )
    values (
      trim(p_data->>'invoice_no'),
      (p_data->>'invoice_date')::date,
      nullif(p_data->>'sent_date', '')::date,
      nullif(trim(coalesce(p_data->>'customer_name', '')), ''),
      nullif(trim(coalesce(p_data->>'customer_address', '')), ''),
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
    perform 1 from finance.invoices where id = v_id for update;
    if not found then
      raise exception 'Invoice not found';
    end if;
    select coalesce(sum(amount), 0) into v_paid from finance.payments where invoice_id = v_id;
    if v_amount < v_paid then
      raise exception 'Amount can''t be less than the % already received', to_char(v_paid, 'FM999,999,999,990.00');
    end if;
    update finance.invoices set
      invoice_no = trim(p_data->>'invoice_no'),
      invoice_date = (p_data->>'invoice_date')::date,
      sent_date = nullif(p_data->>'sent_date', '')::date,
      customer_name = nullif(trim(coalesce(p_data->>'customer_name', '')), ''),
      customer_address = nullif(trim(coalesce(p_data->>'customer_address', '')), ''),
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
