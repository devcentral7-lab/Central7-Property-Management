import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalProfile } from "@/lib/auth";
import {
  loadPropertyPdfData,
  type PdfCopy,
  type PropertyPdfData,
} from "@/lib/pdf/property-pdf-data";
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

function pdfFilename(data: PropertyPdfData): string {
  const title = /\sin$/.test(data.eyebrow)
    ? `${data.eyebrow.toUpperCase()} ${data.heading}`
    : data.eyebrow.toUpperCase();
  const name = `${data.refNo}- ${title}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return `${name}.pdf`;
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[’‘]/g, "'").replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
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
  const copy: PdfCopy = req.nextUrl.searchParams.get("copy") === "agent" ? "agent" : "client";

  try {
    const data = await loadPropertyPdfData(ref, copy);
    if (!data) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    const pdf = await renderPropertyPdf(
      data,
      copy === "client" ? await loadLogo(req.nextUrl.origin) : null,
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(pdfFilename(data)),
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
