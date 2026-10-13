-- A staff member's own sales figures for their dashboard: credited sales in a
-- date range, quarterly credits and target for a year. Only reads the finance
-- agent linked to the caller's login; null when there is no linked agent.

create or replace function public.finance_my_performance(p_from date, p_to date, p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, finance
as $$
declare
  v_agent finance.agents%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  select * into v_agent
  from finance.agents a
  where a.profile_id = auth.uid()
  order by a.sales_agent desc, a.active desc, a.created_at
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'agent', v_agent.name,
    'sales_value', coalesce((
      select sum(ia.amount)
      from finance.invoice_agents ia
      join finance.invoices i on i.id = ia.invoice_id
      where ia.agent_id = v_agent.id and i.voided_at is null
        and i.invoice_date between p_from and p_to
    ), 0),
    'invoices', (
      select count(*)
      from finance.invoice_agents ia
      join finance.invoices i on i.id = ia.invoice_id
      where ia.agent_id = v_agent.id and i.voided_at is null
        and i.invoice_date between p_from and p_to
    ),
    'quarterly', (
      select jsonb_agg(coalesce(s.amt, 0) order by q.n)
      from generate_series(1, 4) as q(n)
      left join (
        select extract(quarter from i.invoice_date)::int as n, sum(ia.amount) as amt
        from finance.invoice_agents ia
        join finance.invoices i on i.id = ia.invoice_id
        where ia.agent_id = v_agent.id and i.voided_at is null
          and extract(year from i.invoice_date)::int = p_year
        group by 1
      ) s on s.n = q.n
    ),
    'target', (
      select t.target from finance.agent_targets t
      where t.agent_id = v_agent.id and t.year = p_year
    )
  );
end;
$$;

revoke all on function public.finance_my_performance(date, date, integer) from public, anon;
grant execute on function public.finance_my_performance(date, date, integer) to authenticated;
