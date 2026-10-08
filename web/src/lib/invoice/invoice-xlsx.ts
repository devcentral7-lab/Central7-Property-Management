import ExcelJS from "exceljs";
import { INVOICE_COMPANY, type InvoicePrint } from "@/lib/invoice/invoice-print";

// Layout follows the Central 7 invoice template workbook (Sheet1, columns A–F).
const FONT = "Calibri";
const SIZE = 10;
const MONEY = "#,##0.00";
const RED = "FFED1C24";
const GREY = "FFD9D9D9";
const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const medium: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF000000" } };
const ROW_H = 13.5;
const WIDTHS = [13, 11, 8, 14, 37, 16];
/** Approximate characters that fit across the merged description columns B–E. */
const DESC_CHARS = 80;
const EMU_PER_PX = 9525;

type Font = Partial<ExcelJS.Font>;

/** exceljs scales fractional anchors by the wrong unit, so place images by pixel offset. */
function at(col: number, colPx: number, row: number, rowPx: number) {
  return {
    nativeCol: col,
    nativeColOff: Math.round(colPx * EMU_PER_PX),
    nativeRow: row,
    nativeRowOff: Math.round(rowPx * EMU_PER_PX),
  } as unknown as ExcelJS.Anchor;
}

export async function buildInvoiceWorkbook(
  inv: InvoicePrint,
  logo: Buffer | null,
  signature: Buffer | null,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = INVOICE_COMPANY.name;
  const ws = wb.addWorksheet("Sheet1", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: ROW_H },
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.95, right: 0.6, top: 0.7, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  wb.addWorksheet("Sheet2");
  wb.addWorksheet("Sheet3");
  ws.columns = WIDTHS.map((width) => ({ width }));

  function put(addr: string, value: ExcelJS.CellValue, font: Font = {}, alignment?: Partial<ExcelJS.Alignment>) {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = { name: FONT, size: SIZE, ...font };
    if (alignment) cell.alignment = alignment;
    return cell;
  }
  function border(addr: string, b: Partial<ExcelJS.Borders>) {
    const cell = ws.getCell(addr);
    cell.border = { ...cell.border, ...b };
  }
  function fill(addr: string, argb: string) {
    ws.getCell(addr).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
  function money(addr: string, bold = false) {
    const cell = put(addr, inv.amount, { bold }, { horizontal: "right" });
    cell.numFmt = MONEY;
  }
  function wrappedRow(row: number, text: string, chars: number) {
    const lines = Math.max(1, Math.ceil(text.length / chars));
    if (lines > 1) ws.getRow(row).height = ROW_H * lines;
  }
  const B_TO_E = ["B", "C", "D", "E"];

  put("A2", INVOICE_COMPANY.name, { size: 14, bold: true });
  INVOICE_COMPANY.addressLines.forEach((line, i) => put(`A${3 + i}`, line));
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: at(4, 236, 1, 2), ext: { width: 49, height: 70 } });
  }

  ws.mergeCells("A7:F7");
  put(
    "A7",
    inv.voided
      ? { richText: [{ text: "INVOICE", font: { name: FONT, size: 12, bold: true, underline: true } }, { text: " (VOID)", font: { name: FONT, size: 12, bold: true, color: { argb: RED } } }] }
      : "INVOICE",
    { size: 12, bold: true, underline: true },
    { horizontal: "center", vertical: "middle" },
  );
  ws.getRow(7).height = 18;
  for (const c of ["A", "B", "C", "D", "E", "F"]) fill(`${c}7`, GREY);

  put("A9", "Client");
  put("B9", `: ${inv.client}`);
  put("E9", "Invoice No :", {}, { horizontal: "right" });
  put("F9", inv.invoiceNo);
  put("E10", "Date :", {}, { horizontal: "right" });
  put("F10", inv.date);

  const address = inv.addressLines.length ? inv.addressLines : [""];
  put("A11", "Address");
  address.forEach((line, i) => put(`B${11 + i}`, i === 0 ? `: ${line}` : `  ${line}`));

  // Description table
  const head = 11 + Math.max(2, address.length) + 1;
  put(`A${head}`, "Date", {}, { horizontal: "center" });
  ws.mergeCells(`B${head}:E${head}`);
  put(`B${head}`, "Description of Service", {}, { horizontal: "center" });
  put(`F${head}`, "Amount (LKR)", {}, { horizontal: "center" });
  for (const c of ["A", ...B_TO_E, "F"]) border(`${c}${head}`, { top: thin, bottom: thin, left: thin, right: thin });

  const first = head + 1;
  put(`A${first}`, inv.date, {}, { vertical: "top" });
  ws.mergeCells(`B${first}:E${first}`);
  put(`B${first}`, inv.title, { bold: true }, { vertical: "top", wrapText: true });
  wrappedRow(first, inv.title, DESC_CHARS);
  money(`F${first}`);
  ws.getCell(`F${first}`).alignment = { horizontal: "right", vertical: "top" };

  const extraStart = first + 4;
  inv.extraLines.forEach((line, i) => {
    const row = extraStart + i;
    ws.mergeCells(`B${row}:E${row}`);
    put(`B${row}`, line, { italic: true }, { wrapText: true, vertical: "top" });
    wrappedRow(row, line, DESC_CHARS + 6);
  });
  const boxEnd = Math.max(first + 8, inv.extraLines.length ? extraStart + inv.extraLines.length + 2 : 0);
  for (let row = first; row <= boxEnd; row++) {
    border(`A${row}`, { left: thin, right: thin });
    border(`F${row}`, { left: thin, right: thin });
  }
  for (const c of ["A", ...B_TO_E, "F"]) border(`${c}${boxEnd}`, { bottom: thin });

  const total = boxEnd + 1;
  ws.mergeCells(`B${total}:E${total}`);
  put(`B${total}`, "Total Amount");
  money(`F${total}`);
  for (const c of ["A", ...B_TO_E, "F"]) border(`${c}${total}`, { top: thin, bottom: thin, left: thin, right: thin });

  const payable = total + 1;
  ws.mergeCells(`D${payable}:E${payable}`);
  put(`D${payable}`, "Total  Payable (LKR)", { bold: true });
  money(`F${payable}`, true);
  for (const c of ["D", "E", "F"]) {
    border(`${c}${payable}`, {
      top: thin,
      bottom: medium,
      ...(c === "D" || c === "F" ? { left: thin } : {}),
      ...(c === "E" || c === "F" ? { right: thin } : {}),
    });
  }

  // Payment instructions
  const cheque = payable + 3;
  put(`A${cheque}`, "Cheques/drafts to be drawn in favor of 'CENTRAL 7 (PRIVATE) LIMITED' or Direct transfers");
  put(`A${cheque + 1}`, "to be made to the below account");

  const bank = cheque + 3;
  INVOICE_COMPANY.bank.forEach(([label, value], i) => {
    put(`A${bank + i}`, label);
    put(`C${bank + i}`, `: ${value}`);
  });

  // Signature
  const dots = bank + INVOICE_COMPANY.bank.length + 4;
  if (signature) {
    const id = wb.addImage({ buffer: signature as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: at(0, 92, dots - 4, 4), ext: { width: 64, height: 32 } });
  }
  ws.mergeCells(`A${dots}:C${dots}`);
  put(`A${dots}`, ".".repeat(50), {}, { horizontal: "center", shrinkToFit: true });
  ws.mergeCells(`A${dots + 1}:C${dots + 1}`);
  put(`A${dots + 1}`, "Authorized Signatory", {}, { horizontal: "center" });

  const footer = dots + 3;
  ws.mergeCells(`A${footer}:F${footer}`);
  put(`A${footer}`, INVOICE_COMPANY.footer, { bold: true, size: 11, color: { argb: "FFFFFFFF" } }, { horizontal: "center", vertical: "middle" });
  for (const c of ["A", "B", "C", "D", "E", "F"]) fill(`${c}${footer}`, RED);

  ws.pageSetup.printArea = `A1:F${footer}`;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
