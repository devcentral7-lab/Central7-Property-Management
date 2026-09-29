import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalProfile } from "@/lib/auth";
import { loadPropertyPdfData, type PdfCopy } from "@/lib/pdf/property-pdf-data";
import { renderPropertyPdf } from "@/lib/pdf/property-pdf-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let logoCache: Buffer | null | undefined;

async function loadLogo(origin: string): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), "public", "logo.jpg"));
  } catch {
    try {
      const res = await fetch(new URL("/logo.jpg", origin));
      logoCache = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch {
      logoCache = null;
    }
  }
  return logoCache;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const profile = await getOptionalProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ref } = await params;
  const copy: PdfCopy = req.nextUrl.searchParams.get("copy") === "full" ? "full" : "client";

  try {
    const data = await loadPropertyPdfData(ref, copy, profile);
    if (!data) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    const pdf = await renderPropertyPdf(data, await loadLogo(req.nextUrl.origin));
    const filename = `${data.refNo}${copy === "full" ? "-internal" : ""}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create PDF" },
      { status: 500 },
    );
  }
}
