import type { FinanceInvoiceDetail } from "@/lib/finance-shared";

/** Fixed text from the Central 7 invoice template. */
export const INVOICE_COMPANY = {
  name: "Central 7 (Private) Limited",
  addressLines: ["No 21, 2nd Floor,", "Aloe Avenue,", "Colombo-03."],
  chequeNote:
    "Cheques/drafts to be drawn in favor of 'CENTRAL 7 (PRIVATE) LIMITED' or Direct transfers to be made to the below account",
  bank: [
    ["Name", "CENTRAL 7 (PVT) LTD"],
    ["Acc No", "076010095798"],
    ["Currency", "LKR"],
    ["Bank", "Hatton National Bank"],
    ["SWIFT Code", "HBLILKLX"],
    ["Bank Code", "7083"],
    ["Branch Code", "076"],
    ["Bank Address", "No. 85A, 87, Barnes Place, Colombo-07."],
  ] as const,
  footer: "info@central7.lk | www.central7.lk |+94 77 22 99 515",
};

export type InvoicePrint = {
  invoiceNo: string;
  /** dd-mm-yyyy, as printed on the template. */
  date: string;
  client: string;
  addressLines: string[];
  /** First line of the description, printed in bold. */
  title: string;
  /** Further description lines, printed in italics. */
  extraLines: string[];
  amount: number;
  voided: boolean;
};

export function printDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

export function printAmount(n: number): string {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lines(text: string | null): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function toInvoicePrint(inv: FinanceInvoiceDetail): InvoicePrint {
  const [first = "", ...rest] = lines(inv.details);
  const ref = inv.property_ref?.trim();
  const title =
    ref && !first.toUpperCase().includes(ref.toUpperCase())
      ? `${first}${first ? "  " : ""}(Ref: ${ref})`
      : first;
  return {
    invoiceNo: inv.invoice_no,
    date: printDate(inv.invoice_date),
    client: inv.customer_name?.trim() ?? "",
    addressLines: lines(inv.customer_address),
    title,
    extraLines: rest,
    amount: Number(inv.amount),
    voided: Boolean(inv.voided_at),
  };
}

export function invoiceFilename(inv: InvoicePrint, ext: "pdf" | "xlsx"): string {
  const base = inv.invoiceNo.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim() || "invoice";
  return `${base}.${ext}`;
}
