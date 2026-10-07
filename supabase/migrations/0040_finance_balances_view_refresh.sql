-- invoice_balances was created with i.* before 0039 added updated_by,
-- updated_by_name, void_reason and voided_by_name; a view's column list is
-- fixed when it's created, so rebuild it to pick those up.

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
