-- Company-wide sales for the admin dashboard: everything credited to agents in
-- a date range, plus quarterly credits for a year (all agents, matching the
-- old "Company Overall Sales" figures).

create or replace function public.finance_company_performance(p_from date, p_to date, p_year integer)
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

  return jsonb_build_object(
    'sales_value', coalesce((
      select sum(ia.amount)
      from finance.invoice_agents ia
      join finance.invoices i on i.id = ia.invoice_id
      where i.voided_at is null and i.invoice_date between p_from and p_to
    ), 0),
    'invoices', (
      select count(distinct i.id)
      from finance.invoices i
      join finance.invoice_agents ia on ia.invoice_id = i.id
      where i.voided_at is null and i.invoice_date between p_from and p_to
    ),
    'quarterly', (
      select jsonb_agg(coalesce(s.amt, 0) order by q.n)
      from generate_series(1, 4) as q(n)
      left join (
        select extract(quarter from i.invoice_date)::int as n, sum(ia.amount) as amt
        from finance.invoice_agents ia
        join finance.invoices i on i.id = ia.invoice_id
        where i.voided_at is null and extract(year from i.invoice_date)::int = p_year
        group by 1
      ) s on s.n = q.n
    )
  );
end;
$$;

revoke all on function public.finance_company_performance(date, date, integer) from public, anon;
grant execute on function public.finance_company_performance(date, date, integer) to authenticated;
