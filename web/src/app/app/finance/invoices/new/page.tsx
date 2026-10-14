import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  financeListHref,
  financeListQuery,
  loadFinanceAgents,
  loadNextInvoiceNo,
  todayIso,
} from "@/lib/finance";
import { FinanceHeader } from "@/app/app/finance/finance-ui";
import { InvoiceForm } from "@/app/app/finance/invoice-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.toUpperCase().slice(0, 20) : "";
  const listQuery = financeListQuery(new URLSearchParams(typeof sp.from === "string" ? sp.from : ""));

  const [agents, nextInvoiceNo] = await Promise.all([loadFinanceAgents(), loadNextInvoiceNo(todayIso())]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <FinanceHeader title="New invoice" back={{ href: financeListHref(listQuery), label: "Finance" }} />
      <InvoiceForm
        agents={agents}
        nextInvoiceNo={nextInvoiceNo}
        defaultPropertyRef={ref}
        listQuery={listQuery}
      />
    </div>
  );
}
