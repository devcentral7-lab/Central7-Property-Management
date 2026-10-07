-- With an agent selected, the revenue-type and category figures show that
-- agent's credited share (as the old Apps Script dashboard did); invoice
-- totals (invoiced / received / outstanding) stay whole-invoice.

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
    select b.*,
      case when p_agent is null then b.amount
        else (select ia.amount from finance.invoice_agents ia where ia.invoice_id = b.id and ia.agent_id = p_agent)
      end as credit
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
        select revenue_type, count(*) as cnt, sum(credit) as amt from inv group by revenue_type
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
        select extract(year from i.invoice_date)::int as y, i.category,
          sum(case when p_agent is null then i.amount else ia.amount end) as amt
        from finance.invoices i
        left join finance.invoice_agents ia on p_agent is not null and ia.invoice_id = i.id and ia.agent_id = p_agent
        where i.voided_at is null
          and (p_agent is null or ia.agent_id is not null)
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
