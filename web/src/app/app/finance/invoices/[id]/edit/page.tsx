import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { financeListQuery, invoiceHref, loadFinanceAgents, loadInvoice } from "@/lib/finance";
import { FinanceHeader } from "@/app/app/finance/finance-ui";
import { InvoiceForm } from "@/app/app/finance/invoice-form";

export default async function EditInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");
  const { id } = await params;
  const { from } = await searchParams;
  const listQuery = financeListQuery(new URLSearchParams(typeof from === "string" ? from : ""));
  const [invoice, agents] = await Promise.all([loadInvoice(id), loadFinanceAgents()]);
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <FinanceHeader
        title={`Edit ${invoice.invoice_no}`}
        back={{ href: invoiceHref(invoice.id, listQuery), label: invoice.invoice_no }}
      />
      <InvoiceForm agents={agents} invoice={invoice} listQuery={listQuery} />
    </div>
  );
}
