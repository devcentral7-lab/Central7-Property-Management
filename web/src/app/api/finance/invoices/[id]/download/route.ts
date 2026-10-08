import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { logAudit } from "@/lib/audit";
import { getOptionalProfile } from "@/lib/auth";
import { loadInvoice } from "@/lib/finance";
import { renderInvoicePdf } from "@/lib/invoice/invoice-pdf";
import { invoiceFilename, toInvoicePrint } from "@/lib/invoice/invoice-print";
import { buildInvoiceWorkbook } from "@/lib/invoice/invoice-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assetCache = new Map<string, Buffer | null>();

async function loadAsset(name: string, origin: string): Promise<Buffer | null> {
  if (assetCache.has(name)) return assetCache.get(name) ?? null;
  let data: Buffer | null = null;
  try {
    data = await readFile(path.join(process.cwd(), "public", name));
  } catch {
    try {
      const res = await fetch(new URL(`/${name}`, origin));
      data = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch {
      data = null;
    }
  }
  assetCache.set(name, data);
  return data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getOptionalProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "Admin") return NextResponse.json({ error: "Only Admin can download invoices" }, { status: 403 });

  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const { id } = await params;

  try {
    const invoice = await loadInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const print = toInvoicePrint(invoice);
    const origin = req.nextUrl.origin;
    const [logo, signature] = await Promise.all([
      loadAsset("invoice-logo.png", origin),
      loadAsset("invoice-signature.png", origin),
    ]);
    const file =
      format === "pdf"
        ? await renderInvoicePdf(print, logo, signature)
        : await buildInvoiceWorkbook(print, logo, signature);

    await logAudit({
      category: "finance",
      action: "invoice_export",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "invoice",
      subjectId: invoice.id,
      subjectLabel: invoice.invoice_no,
      summary: `Downloaded invoice ${invoice.invoice_no} as ${format === "pdf" ? "PDF" : "Excel"}`,
      details: { format },
    });

    const filename = invoiceFilename(print, format);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create the invoice file" },
      { status: 500 },
    );
  }
}
