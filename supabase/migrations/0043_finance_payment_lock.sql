-- Lock the invoice row before balance checks so two payments (or a payment and
-- an amount edit) saved at the same moment can't overpay an invoice.

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
  perform 1 from finance.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  select outstanding, voided_at into v_outstanding, v_voided
  from finance.invoice_balances where id = p_invoice_id;
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
