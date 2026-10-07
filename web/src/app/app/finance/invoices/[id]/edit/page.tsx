import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { loadFinanceAgents, loadInvoice } from "@/lib/finance";
import { FinanceHeader } from "@/app/app/finance/finance-ui";
import { InvoiceForm } from "@/app/app/finance/invoice-form";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");
  const { id } = await params;
  const [invoice, agents] = await Promise.all([loadInvoice(id), loadFinanceAgents()]);
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <FinanceHeader
        title={`Edit ${invoice.invoice_no}`}
        back={{ href: `/app/finance/invoices/${invoice.id}`, label: invoice.invoice_no }}
      />
      <InvoiceForm agents={agents} invoice={invoice} />
    </div>
  );
}
