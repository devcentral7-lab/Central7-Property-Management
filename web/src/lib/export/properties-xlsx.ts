import ExcelJS from "exceljs";

export type ExportPropertyRow = Record<string, unknown> & {
  apartment_complexes?: { name: string | null } | null;
};

type Kind = "text" | "center" | "int" | "measure" | "money" | "date" | "status" | "phone";

type Column = {
  header: string;
  width: number;
  kind?: Kind;
  value: (p: ExportPropertyRow) => string | number | Date | null;
};

type Meta = { owner: string; exportedBy: string; exportedAt: Date; filters?: string };

function withFilters(subtitle: string, meta: Meta) {
  return meta.filters ? `${subtitle}  ·  Filters: ${meta.filters}` : subtitle;
}

const FONT = "Calibri";
const INK = "FF111827";
const BODY = "FF374151";
const MUTED = "FF6B7280";
const BRAND = "FFC8102E";
const HEADER_BG = "FF1F2937";
const RULE = "FFE5E7EB";
const ZEBRA = "FFF9FAFB";
const CARD_BG = "FFF3F4F6";

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  Active: { fg: "FF166534", bg: "FFDCFCE7" },
  Hold: { fg: "FF92400E", bg: "FFFEF3C7" },
  Lost: { fg: "FF991B1B", bg: "FFFEE2E2" },
  Drop: { fg: "FF991B1B", bg: "FFFEE2E2" },
  Closed: { fg: "FF1E40AF", bg: "FFDBEAFE" },
  Obsolete: { fg: "FF4B5563", bg: "FFF3F4F6" },
};

function text(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Numeric strings become numbers so Excel doesn't flag "number stored as text". */
function numOrText(v: unknown): number | string | null {
  const t = text(v);
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

/** Excel has no time zones; shift so the sheet shows Sri Lanka time. */
function localDate(v: unknown): Date | null {
  const t = text(v);
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms + COLOMBO_OFFSET_MS) : null;
}

function attr(p: ExportPropertyRow, key: string): unknown {
  return ((p.type_attributes || {}) as Record<string, unknown>)[key];
}

function currencyOf(p: ExportPropertyRow): string {
  return (text(p.currency) || "LKR").replace(/[^A-Za-z]/g, "").toUpperCase() || "LKR";
}

const COLUMNS: Column[] = [
  { header: "Ref No", width: 12, value: (p) => text(p.ref_no) },
  { header: "Status", width: 12, kind: "status", value: (p) => text(p.status) },
  { header: "Property Type", width: 20, value: (p) => text(p.property_type) },
  { header: "Sub-type", width: 20, value: (p) => text(p.property_subtype) },
  { header: "Opportunity", width: 13, value: (p) => text(p.opportunity_type) },
  { header: "City", width: 16, value: (p) => text(p.city) },
  { header: "Address", width: 34, value: (p) => text(p.address) },
  {
    header: "Apartment Complex",
    width: 26,
    value: (p) => text(p.apartment_complexes?.name),
  },
  { header: "Apt. Floor", width: 11, kind: "center", value: (p) => numOrText(p.apartment_floor) },
  { header: "View", width: 16, value: (p) => text(p.view) },
  { header: "Bedrooms", width: 11, kind: "int", value: (p) => num(p.bedrooms) },
  { header: "Bathrooms", width: 11, kind: "int", value: (p) => num(p.bathrooms) },
  { header: "Floor Area (sq.ft)", width: 18, kind: "measure", value: (p) => num(p.floor_area_sqft) },
  { header: "Land (perches)", width: 15, kind: "measure", value: (p) => num(p.land_size_perch) },
  {
    header: "Built-up Area",
    width: 15,
    kind: "measure",
    value: (p) => num(attr(p, "built_up_area")) ?? text(attr(p, "built_up_area")),
  },
  { header: "Floors", width: 9, kind: "int", value: (p) => num(p.number_of_floors) },
  { header: "Parking", width: 10, kind: "int", value: (p) => num(p.parking_spaces) },
  { header: "Age (yrs)", width: 10, kind: "int", value: (p) => num(p.age_years) },
  { header: "Furnished", width: 17, value: (p) => text(p.furnished) },
  { header: "Suitable For", width: 22, value: (p) => text(attr(p, "suitable_for")) },
  { header: "Price / Rent", width: 20, kind: "money", value: (p) => num(p.price_total) },
  { header: "Price per Perch", width: 18, kind: "money", value: (p) => num(p.price_per_perch) },
  { header: "Price per sq.ft", width: 17, kind: "money", value: (p) => num(p.price_per_sqft) },
  { header: "Budget", width: 18, kind: "money", value: (p) => num(p.budget) },
  {
    header: "Amenities",
    width: 40,
    value: (p) =>
      Array.isArray(p.amenities)
        ? (p.amenities as unknown[]).map(text).filter(Boolean).join(", ") || null
        : text(p.amenities),
  },
  { header: "Contact Type", width: 14, value: (p) => text(p.contact_type) },
  { header: "Contact Name", width: 24, value: (p) => text(p.contact_name) },
  { header: "Phone 1", width: 15, kind: "phone", value: (p) => text(p.contact_phone_1) },
  { header: "Phone 2", width: 15, kind: "phone", value: (p) => text(p.contact_phone_2) },
  { header: "Email", width: 28, value: (p) => text(p.contact_email) },
  {
    header: "Publishing",
    width: 16,
    value: (p) => (p.do_not_publish ? "Do not publish" : "Can publish"),
  },
  { header: "Created", width: 14, kind: "date", value: (p) => localDate(p.created_at) },
  { header: "Last Updated", width: 14, kind: "date", value: (p) => localDate(p.updated_at) },
  { header: "Comments", width: 60, value: (p) => text(p.comments) },
  { header: "Internal Comments", width: 60, value: (p) => text(p.internal_comments) },
];

const RIGHT: Kind[] = ["int", "measure", "money"];
const CENTER: Kind[] = ["center", "status", "date"];

function font(extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT, size: 10, color: { argb: BODY }, ...extra };
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const hairline: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin", color: { argb: RULE } },
};

function formatStamp(d: Date): string {
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function numFmtFor(kind: Kind | undefined, value: unknown, p: ExportPropertyRow) {
  if (typeof value !== "number") return kind === "date" && value ? "dd mmm yyyy" : undefined;
  if (kind === "money") return `"${currencyOf(p)} "#,##0`;
  if (kind === "measure") return Number.isInteger(value) ? "#,##0" : "#,##0.00";
  if (kind === "int" || kind === "center") return "0";
  return undefined;
}

/** Title block: brand eyebrow, title and a muted subtitle, no merged cells. */
function writeTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  const eyebrow = ws.getCell("A1");
  eyebrow.value = "CENTRAL7 PULSE";
  eyebrow.font = font({ size: 9, bold: true, color: { argb: BRAND } });
  eyebrow.alignment = { vertical: "bottom" };
  ws.getRow(1).height = 18;

  const t = ws.getCell("A2");
  t.value = title;
  t.font = font({ size: 18, bold: true, color: { argb: INK } });
  t.alignment = { vertical: "middle" };
  ws.getRow(2).height = 28;

  const s = ws.getCell("A3");
  s.value = subtitle;
  s.font = font({ size: 10, color: { argb: MUTED } });
  s.alignment = { vertical: "top" };
  ws.getRow(3).height = 20;
}

function addListingsSheet(wb: ExcelJS.Workbook, rows: ExportPropertyRow[], meta: Meta) {
  const HEADER_ROW = 5;
  const ws = wb.addWorksheet("Listings", {
    properties: { tabColor: { argb: BRAND } },
    views: [
      { state: "frozen", xSplit: 1, ySplit: HEADER_ROW, showGridLines: false, zoomScale: 100 },
    ],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L&8Central7 Pulse · ${meta.owner}&R&8Page &P of &N`,
    },
  });

  ws.columns = COLUMNS.map((c) => ({
    width: Math.max(c.width, c.header.length + 6),
  }));

  writeTitle(
    ws,
    `Listings · ${meta.owner}`,
    withFilters(
      `${rows.length.toLocaleString("en-US")} listings  ·  Exported ${formatStamp(meta.exportedAt)} by ${meta.exportedBy}`,
      meta,
    ),
  );
  ws.getRow(4).height = 8;

  const header = ws.getRow(HEADER_ROW);
  header.height = 30;
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = solid(HEADER_BG);
    cell.border = { bottom: { style: "medium", color: { argb: BRAND } } };
    const right = c.kind && RIGHT.includes(c.kind);
    const center = c.kind && CENTER.includes(c.kind);
    // Right-aligned headers need an indent to clear the filter dropdown button.
    cell.alignment = {
      vertical: "middle",
      horizontal: right ? "right" : center ? "center" : "left",
      indent: right ? 1 : center ? 0 : 1,
    };
  });

  rows.forEach((p, idx) => {
    const row = ws.getRow(HEADER_ROW + 1 + idx);
    row.height = 20;
    const zebra = idx % 2 === 1;

    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const value = c.value(p);
      cell.value = value;
      cell.font = font();
      cell.border = hairline;
      if (zebra) cell.fill = solid(ZEBRA);

      const right = c.kind && RIGHT.includes(c.kind) && typeof value === "number";
      const center = c.kind && CENTER.includes(c.kind);
      cell.alignment = {
        vertical: "middle",
        horizontal: right ? "right" : center ? "center" : "left",
        indent: right || center ? 0 : 1,
      };

      const fmt = numFmtFor(c.kind, value, p);
      if (fmt) cell.numFmt = fmt;

      if (c.kind === "status" && typeof value === "string") {
        const s = STATUS_STYLE[value];
        if (s) {
          cell.font = font({ bold: true, color: { argb: s.fg } });
          cell.fill = solid(s.bg);
        }
      }
    });

    row.getCell(1).font = font({ bold: true, color: { argb: INK } });
    if (p.do_not_publish) {
      const col = COLUMNS.findIndex((c) => c.header === "Publishing") + 1;
      row.getCell(col).font = font({ bold: true, color: { argb: "FF991B1B" } });
    }
  });

  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW + Math.max(rows.length, 1), column: COLUMNS.length },
  };
}

function addSummarySheet(wb: ExcelJS.Workbook, rows: ExportPropertyRow[], meta: Meta) {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: HEADER_BG } },
    views: [{ showGridLines: false }],
  });
  // Four equal groups (label, count, share) separated by narrow gutters.
  const GROUPS = [2, 6, 10, 14];
  ws.columns = [{ width: 3 }, ...GROUPS.flatMap(() => [{ width: 24 }, { width: 11 }, { width: 9 }, { width: 3 }])];

  const eyebrow = ws.getCell("B1");
  eyebrow.value = "CENTRAL7 PULSE";
  eyebrow.font = font({ size: 9, bold: true, color: { argb: BRAND } });
  ws.getRow(1).height = 18;
  const title = ws.getCell("B2");
  title.value = `Listings summary · ${meta.owner}`;
  title.font = font({ size: 18, bold: true, color: { argb: INK } });
  ws.getRow(2).height = 28;
  const sub = ws.getCell("B3");
  sub.value = withFilters(`Exported ${formatStamp(meta.exportedAt)} by ${meta.exportedBy}`, meta);
  sub.font = font({ color: { argb: MUTED } });

  const count = (pred: (p: ExportPropertyRow) => boolean) => rows.filter(pred).length;
  const cards: [string, number][] = [
    ["Total listings", rows.length],
    ["Active", count((p) => p.status === "Active")],
    ["For sale", count((p) => p.opportunity_type === "Sell")],
    ["For rent", count((p) => /rent|lease/i.test(String(p.opportunity_type ?? "")))],
  ];

  ws.getRow(5).height = 20;
  ws.getRow(6).height = 34;
  cards.forEach(([label, value], i) => {
    const col = GROUPS[i];
    const labelCell = ws.getCell(5, col);
    const valueCell = ws.getCell(6, col);
    labelCell.value = label.toUpperCase();
    labelCell.font = font({ size: 9, bold: true, color: { argb: MUTED } });
    valueCell.value = value;
    valueCell.numFmt = "#,##0";
    valueCell.font = font({ size: 22, bold: true, color: { argb: i === 0 ? BRAND : INK } });
    for (let c = col; c < col + 3; c++) {
      for (const r of [5, 6]) {
        const cell = ws.getCell(r, c);
        cell.fill = solid(CARD_BG);
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        if (c === col) cell.border = { left: { style: "thick", color: { argb: BRAND } } };
      }
    }
  });

  const tally = (pick: (p: ExportPropertyRow) => unknown, limit?: number) => {
    const counts = new Map<string, number>();
    for (const p of rows) {
      const k = text(pick(p)) ?? "Not set";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return limit ? sorted.slice(0, limit) : sorted;
  };

  const TABLE_ROW = 9;
  const table = (col: number, heading: string, data: [string, number][], statusColors = false) => {
    const head = ws.getRow(TABLE_ROW);
    head.height = 24;
    [heading, "Listings", "Share"].forEach((h, i) => {
      const cell = head.getCell(col + i);
      cell.value = h;
      cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = solid(HEADER_BG);
      cell.border = { bottom: { style: "medium", color: { argb: BRAND } } };
      cell.alignment = { vertical: "middle", horizontal: i ? "right" : "left", indent: i ? 0 : 1 };
    });
    data.forEach(([label, n], i) => {
      const r = ws.getRow(TABLE_ROW + 1 + i);
      r.height = 20;
      const cells = [r.getCell(col), r.getCell(col + 1), r.getCell(col + 2)];
      cells[0].value = label;
      cells[1].value = n;
      cells[1].numFmt = "#,##0";
      cells[2].value = rows.length ? n / rows.length : 0;
      cells[2].numFmt = "0%";
      cells.forEach((cell, j) => {
        cell.font = font();
        cell.border = hairline;
        cell.alignment = { vertical: "middle", horizontal: j ? "right" : "left", indent: j ? 0 : 1 };
        if (i % 2 === 1) cell.fill = solid(ZEBRA);
      });
      const s = statusColors ? STATUS_STYLE[label] : undefined;
      if (s) cells[0].font = font({ bold: true, color: { argb: s.fg } });
    });
  };

  table(GROUPS[0], "Status", tally((p) => p.status), true);
  table(GROUPS[1], "Opportunity", tally((p) => p.opportunity_type));
  table(GROUPS[2], "Property type", tally((p) => p.property_type));
  table(GROUPS[3], "Top cities", tally((p) => p.city, 10));
}

export async function buildPropertiesWorkbook(
  rows: ExportPropertyRow[],
  meta: { owner: string; exportedBy: string; exportedAt?: Date; filters?: string },
): Promise<Buffer> {
  const exportedAt = meta.exportedAt ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Central7 Pulse";
  wb.created = exportedAt;
  wb.title = `Listings · ${meta.owner}`;

  const m: Meta = {
    owner: meta.owner,
    exportedBy: meta.exportedBy,
    exportedAt,
    filters: meta.filters,
  };
  addListingsSheet(wb, rows, m);
  addSummarySheet(wb, rows, m);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
