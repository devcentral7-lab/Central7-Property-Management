import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  INVOICE_COMPANY,
  printAmount,
  type InvoicePrint,
} from "@/lib/invoice/invoice-print";

Font.registerHyphenationCallback((word) => [word]);

// Measurements follow the Central 7 invoice template (A4, points).
const LINE = 0.75;
const DATE_W = 52;
const AMOUNT_W = 74;
const RED = "#ed1c24";
const BODY = 9;
/** Unitless lineHeight scales by the element's own fontSize (default 18), not the inherited one. */
const lh = (multiple: number) => ({ fontSize: BODY, lineHeight: multiple });

const s = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingLeft: 74,
    paddingRight: 58,
    paddingBottom: 40,
    fontFamily: "Helvetica",
    fontSize: BODY,
    color: "#000000",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  company: { fontFamily: "Helvetica-Bold", fontSize: 15, marginBottom: 3 },
  companyLine: lh(1.4),
  logo: { height: 52, marginRight: 50, marginTop: 2 },
  bar: {
    marginTop: 11,
    height: 20,
    backgroundColor: "#d9d9d9",
    alignItems: "center",
    justifyContent: "center",
  },
  barText: { fontFamily: "Helvetica-Bold", fontSize: 13, textDecoration: "underline" },
  meta: { marginTop: 11, flexDirection: "row", justifyContent: "space-between" },
  labelCell: { width: 51, paddingLeft: 2 },
  colon: { width: 8 },
  metaRight: { flexDirection: "row", marginRight: 22 },
  metaLabel: { textAlign: "right", ...lh(1.35) },
  metaValue: { width: 54, paddingLeft: 3, ...lh(1.35) },
  addressRow: { flexDirection: "row", marginTop: 0 },
  addressLine: lh(1.4),
  table: { marginTop: 12, borderTopWidth: LINE, borderLeftWidth: LINE, borderColor: "#000" },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: LINE, borderBottomWidth: LINE, borderColor: "#000", paddingHorizontal: 2, paddingVertical: 1.5 },
  head: { textAlign: "center" },
  body: { minHeight: 110 },
  title: { fontFamily: "Helvetica-Bold" },
  extra: { marginTop: 40 },
  italic: { fontFamily: "Helvetica-Oblique", ...lh(1.35) },
  amount: { textAlign: "right" },
  payableRow: { flexDirection: "row", marginLeft: 158 },
  payableCell: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 2,
    paddingVertical: 1.5,
    fontFamily: "Helvetica-Bold",
  },
  cheque: { marginTop: 18, ...lh(1.45) },
  bank: { marginTop: 11 },
  bankRow: { flexDirection: "row", ...lh(1.35) },
  bankLabel: { width: 111, paddingLeft: 2 },
  sigBlock: { marginTop: 22, width: 130 },
  signature: { width: 46, marginLeft: 58 },
  dots: {
    marginTop: 9,
    marginLeft: 27,
    width: 103,
    borderBottomWidth: 1,
    borderBottomStyle: "dotted",
    borderColor: "#000",
  },
  signatory: { marginTop: 5, marginLeft: 27, width: 103, textAlign: "center" },
  footer: {
    marginTop: 14,
    height: 13.5,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { fontFamily: "Helvetica-Bold", color: "#ffffff" },
  void: { color: RED },
});

function InvoiceDocument({
  inv,
  logo,
  signature,
}: {
  inv: InvoicePrint;
  logo: Buffer | null;
  signature: Buffer | null;
}) {
  const [firstAddress = "", ...moreAddress] = inv.addressLines;
  return (
    <Document title={`Invoice ${inv.invoiceNo}`} author={INVOICE_COMPANY.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.company}>{INVOICE_COMPANY.name}</Text>
            {INVOICE_COMPANY.addressLines.map((l) => (
              <Text key={l} style={s.companyLine}>
                {l}
              </Text>
            ))}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          {logo ? <Image src={{ data: logo, format: "png" }} style={s.logo} /> : null}
        </View>

        <View style={s.bar}>
          <Text style={s.barText}>
            INVOICE{inv.voided ? <Text style={s.void}> (VOID)</Text> : null}
          </Text>
        </View>

        <View style={s.meta}>
          <View style={s.row}>
            <Text style={s.labelCell}>Client</Text>
            <Text style={s.colon}>:</Text>
            <Text>{inv.client}</Text>
          </View>
          <View style={s.metaRight}>
            <View>
              <Text style={s.metaLabel}>Invoice No :</Text>
              <Text style={s.metaLabel}>Date :</Text>
            </View>
            <View>
              <Text style={s.metaValue}>{inv.invoiceNo}</Text>
              <Text style={s.metaValue}>{inv.date}</Text>
            </View>
          </View>
        </View>

        <View style={s.addressRow}>
          <Text style={s.labelCell}>Address</Text>
          <Text style={s.colon}>:</Text>
          <View>
            <Text style={s.addressLine}>{firstAddress}</Text>
            {moreAddress.map((l, i) => (
              <Text key={i} style={s.addressLine}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.cell, s.head, { width: DATE_W }]}>Date</Text>
            <Text style={[s.cell, s.head, { flex: 1 }]}>Description of Service</Text>
            <Text style={[s.cell, s.head, { width: AMOUNT_W }]}>Amount (LKR)</Text>
          </View>
          <View style={[s.row, s.body]}>
            <Text style={[s.cell, { width: DATE_W }]}>{inv.date}</Text>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.title}>{inv.title}</Text>
              {inv.extraLines.length ? (
                <View style={s.extra}>
                  {inv.extraLines.map((l, i) => (
                    <Text key={i} style={s.italic}>
                      {l}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={[s.cell, s.amount, { width: AMOUNT_W }]}>{printAmount(inv.amount)}</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.cell, { width: DATE_W }]}> </Text>
            <Text style={[s.cell, { flex: 1 }]}>Total Amount</Text>
            <Text style={[s.cell, s.amount, { width: AMOUNT_W }]}>{printAmount(inv.amount)}</Text>
          </View>
        </View>
        <View style={s.payableRow}>
          <Text style={[s.payableCell, { flex: 1, borderRightWidth: 0 }]}>Total  Payable (LKR)</Text>
          <Text style={[s.payableCell, s.amount, { width: AMOUNT_W }]}>{printAmount(inv.amount)}</Text>
        </View>

        <Text style={s.cheque}>{INVOICE_COMPANY.chequeNote}</Text>

        <View style={s.bank}>
          {INVOICE_COMPANY.bank.map(([label, value]) => (
            <View key={label} style={s.bankRow}>
              <Text style={s.bankLabel}>{label}</Text>
              <Text>: {value}</Text>
            </View>
          ))}
        </View>

        <View style={s.sigBlock}>
          {signature ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image src={{ data: signature, format: "png" }} style={s.signature} />
          ) : (
            <View style={{ height: 23 }} />
          )}
          <View style={s.dots} />
          <Text style={s.signatory}>Authorized Signatory</Text>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>{INVOICE_COMPANY.footer}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(inv: InvoicePrint, logo: Buffer | null, signature: Buffer | null) {
  return renderToBuffer(<InvoiceDocument inv={inv} logo={logo} signature={signature} />);
}
