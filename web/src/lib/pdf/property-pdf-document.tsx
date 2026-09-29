import {
  Document,
  Image,
  Link,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { WHATSAPP_PATH, whatsappHref } from "@/lib/whatsapp";
import type {
  GlanceIcon,
  PdfField,
  PropertyPdfData,
} from "@/lib/pdf/property-pdf-data";

const C = {
  red: "#c8102e",
  redDeep: "#9f0c24",
  redPale: "#fbe9ec",
  charcoal: "#1f1f1f",
  ink: "#1c1917",
  muted: "#78716c",
  line: "#ebe7e2",
  bg: "#f7f5f2",
  white: "#ffffff",
};

const PAD_X = 36;
const PAD_TOP = 28;
const FOOTER_H = 50;

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: PAD_TOP,
    paddingBottom: FOOTER_H + 14,
    paddingHorizontal: PAD_X,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.35,
  },

  header: {
    marginTop: -PAD_TOP,
    marginHorizontal: -PAD_X,
    paddingHorizontal: PAD_X,
    paddingVertical: 14,
    backgroundColor: C.charcoal,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accent: { marginHorizontal: -PAD_X, height: 3, backgroundColor: C.red },
  brand: { flexDirection: "row", alignItems: "center" },
  logoTile: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logo: { width: 42, height: 42, borderRadius: 6, objectFit: "cover" },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 15, color: C.white, letterSpacing: 1.6, lineHeight: 1.1 },
  brandSub: { fontSize: 7.5, color: "#ffffffb3", letterSpacing: 1.8, marginTop: 4, lineHeight: 1.1 },
  headRight: { alignItems: "flex-end" },
  refPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff55",
    color: C.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  headDate: { fontSize: 7.5, color: "#ffffff99", marginTop: 5 },
  staffTag: {
    marginTop: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: C.red,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.8,
  },

  hero: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  heroLeft: { flex: 1, paddingRight: 18 },
  eyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: C.red,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heading: { fontFamily: "Times-Bold", fontSize: 25, color: C.charcoal, marginTop: 6, lineHeight: 1.15 },
  priceCard: {
    width: 180,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.red,
    alignItems: "center",
  },
  priceLabel: { fontSize: 7.5, color: "#ffffffcc", letterSpacing: 1.4, textTransform: "uppercase" },
  price: { fontFamily: "Helvetica-Bold", fontSize: 19, color: C.white, lineHeight: 1.1, marginTop: 5 },
  priceNote: { fontSize: 8, color: "#ffffffcc", marginTop: 4 },
  priceDivider: { alignSelf: "stretch", height: 1, backgroundColor: "#ffffff40", marginVertical: 7 },
  pricePhone: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.white, marginTop: 3 },

  section: { marginTop: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionBar: { width: 3, height: 11, borderRadius: 1, backgroundColor: C.red, marginRight: 7 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: C.charcoal,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },

  glanceRow: { flexDirection: "row" },
  glanceCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 9,
  },
  glanceStacked: { flexDirection: "column", paddingHorizontal: 4, paddingVertical: 7 },
  glanceIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.redPale,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  glanceValue: { fontFamily: "Helvetica-Bold", fontSize: 14, color: C.charcoal, lineHeight: 1.1 },
  glanceLabel: { fontSize: 6.5, color: C.muted, marginTop: 2, letterSpacing: 0.8, textTransform: "uppercase" },

  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { paddingVertical: 4.5, borderBottomWidth: 1, borderBottomColor: C.line, paddingRight: 10 },
  cellLast: { borderBottomWidth: 0 },
  label: { fontSize: 7, color: C.muted, letterSpacing: 0.9, textTransform: "uppercase" },
  value: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: C.ink, marginTop: 2 },

  amenityGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  amenityWrap: { width: "33.333%", paddingHorizontal: 4, marginBottom: 8 },
  amenity: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    minHeight: 30,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red, marginRight: 8 },
  amenityName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: C.ink },
  amenityNote: { fontSize: 7.5, color: C.muted, marginTop: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    fontSize: 8.5,
  },
  paragraph: { fontSize: 10, color: C.ink, paddingVertical: 7, lineHeight: 1.45 },

  staffCard: {
    marginTop: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.charcoal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  staffHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  staffBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: C.charcoal,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.8,
  },

  contactRow: { flexDirection: "row", alignItems: "center" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FOOTER_H,
    paddingHorizontal: PAD_X,
    backgroundColor: C.red,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.white, letterSpacing: 1.4 },
  footText: { fontSize: 8, color: "#ffffffd9", marginTop: 3 },
  footPhoneLabel: { fontSize: 7, color: "#ffffffb3", letterSpacing: 1.2, textAlign: "right" },
  footPhone: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.white, marginTop: 2, textAlign: "right" },
  footPhoneLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    textDecoration: "none",
  },
  waLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: "#ffffff26",
    textDecoration: "none",
  },
  waText: { fontSize: 7, color: C.white, marginLeft: 3, letterSpacing: 0.3 },

  galleryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  galleryRef: { fontSize: 8.5, color: C.muted },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  photoWrap: { width: "50%", paddingHorizontal: 5, marginBottom: 10 },
  photoFrame: {
    backgroundColor: C.white,
    borderRadius: 9,
    padding: 4,
    borderWidth: 1,
    borderColor: C.line,
  },
  photo: { width: "100%", height: 138, borderRadius: 6, objectFit: "cover" },
});

function Icon({ name }: { name: GlanceIcon }) {
  const stroke = { stroke: C.red, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      {name === "area" ? <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke} /> : null}
      {name === "land" ? <Path d="M3 19 9 8l4 6 3-4 5 9Z" {...stroke} /> : null}
      {name === "bed" ? (
        <Path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V7h5v2" {...stroke} />
      ) : null}
      {name === "bath" ? (
        <Path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM6 12V6a2 2 0 0 1 4 0" {...stroke} />
      ) : null}
      {name === "floors" ? <Path d="m12 3 9 5-9 5-9-5ZM3 13l9 5 9-5" {...stroke} /> : null}
      {name === "parking" ? (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={3} {...stroke} />
          <Path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

function Section({
  title,
  keep = false,
  children,
}: {
  title: string;
  keep?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={s.section} wrap={!keep}>
      <View style={s.sectionHead} wrap={false} minPresenceAhead={60}>
        <View style={s.sectionBar} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function FieldGrid({ fields, columns = 3 }: { fields: PdfField[]; columns?: number }) {
  const lastRowStart = fields.length - (fields.length % columns || columns);
  const width = `${100 / columns}%`;
  return (
    <View style={s.grid}>
      {fields.map((f, i) => (
        <View
          key={`${f.label}-${i}`}
          wrap={false}
          style={[s.cell, { width }, i >= lastRowStart ? s.cellLast : {}]}
        >
          <Text style={s.label}>{f.label}</Text>
          <Text style={s.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ data }: { data: PropertyPdfData }) {
  return (
    <View style={s.footer} fixed>
      <View>
        <Text style={s.footName}>{data.company.name.toUpperCase()}</Text>
        <Text style={s.footText}>{data.company.address}</Text>
      </View>
      <View>
        <Text style={s.footPhoneLabel}>TELEPHONE</Text>
        <FooterPhone phone={data.company.phone} />
      </View>
    </View>
  );
}

function FooterPhone({ phone }: { phone: string }) {
  const href = whatsappHref(phone);
  if (!href) return <Text style={s.footPhone}>{phone}</Text>;
  return (
    <Link src={href} style={s.footPhoneLink}>
      <Svg width={10} height={10} viewBox="0 0 24 24" style={{ marginRight: 5, marginTop: 2 }}>
        <Path d={WHATSAPP_PATH} fill={C.white} />
      </Svg>
      <Text style={s.footPhone}>{phone}</Text>
    </Link>
  );
}

function WhatsAppPdfLink({ phone }: { phone: string | null | undefined }) {
  const href = whatsappHref(phone);
  if (!href) return null;
  return (
    <Link src={href} style={s.waLink}>
      <Svg width={8} height={8} viewBox="0 0 24 24">
        <Path d={WHATSAPP_PATH} fill={C.white} />
      </Svg>
      <Text style={s.waText}>Chat on WhatsApp</Text>
    </Link>
  );
}

function Header({ data, logo }: { data: PropertyPdfData; logo: Buffer | null }) {
  return (
    <>
      <View style={s.header}>
        <View style={s.brand}>
          {logo ? (
            <View style={s.logoTile}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
              <Image style={s.logo} src={{ data: logo, format: "jpg" }} />
            </View>
          ) : null}
          <View>
            <Text style={s.brandName}>{data.company.name.toUpperCase()}</Text>
            <Text style={s.brandSub}>{data.company.tagline.toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.headRight}>
          <Text style={s.refPill}>{data.refNo}</Text>
          <Text style={s.headDate}>{data.generatedAt}</Text>
          {data.copy === "full" ? <Text style={s.staffTag}>INTERNAL · STAFF ONLY</Text> : null}
        </View>
      </View>
      <View style={s.accent} />
    </>
  );
}

const FEATURED_AMENITIES = 6;

function PropertyPdf({ data, logo }: { data: PropertyPdfData; logo: Buffer | null }) {
  const featured = data.amenities.slice(0, FEATURED_AMENITIES);
  const more = data.amenities.slice(FEATURED_AMENITIES);
  const stacked = data.glance.length > 4;
  const hasStaff =
    data.copy === "full" && (data.owner.length || data.internal.length || data.internalComments);

  return (
    <Document
      title={`${data.refNo} · ${data.eyebrow} ${data.heading}`}
      author={data.company.name}
      creator="Central7 Pulse"
      subject="Property profile"
    >
      <Page size="A4" style={s.page}>
        <Header data={data} logo={logo} />

        <View style={s.hero} wrap={false}>
          <View style={s.heroLeft}>
            <Text style={s.eyebrow}>{data.eyebrow}</Text>
            <Text style={s.heading}>{data.heading}</Text>
          </View>
          <View style={s.priceCard}>
            {data.price ? (
              <>
                <Text style={s.priceLabel}>{data.priceLabel}</Text>
                <Text style={s.price}>{data.price}</Text>
                {data.priceSuffix ? <Text style={s.priceNote}>per month</Text> : null}
                {data.priceNote ? <Text style={s.priceNote}>{data.priceNote}</Text> : null}
                <View style={s.priceDivider} />
              </>
            ) : null}
            <View style={s.contactRow}>
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Path
                  d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
                  stroke={C.white}
                  strokeWidth={2.2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={[s.priceLabel, { marginLeft: 5 }]}>Contact {data.contact.name}</Text>
            </View>
            <Text style={s.pricePhone}>{data.contact.phone}</Text>
            <WhatsAppPdfLink phone={data.contact.phone} />
          </View>
        </View>

        {data.glance.length ? (
          <Section title="Property at a glance" keep>
            <View style={s.glanceRow} wrap={false}>
              {data.glance.map((g, i) => (
                <View
                  key={g.label}
                  style={[
                    s.glanceCard,
                    stacked ? s.glanceStacked : {},
                    i < data.glance.length - 1 ? { marginRight: 7 } : {},
                  ]}
                >
                  <View style={[s.glanceIcon, stacked ? { marginRight: 0, marginBottom: 5 } : {}]}>
                    <Icon name={g.icon} />
                  </View>
                  <View style={stacked ? { alignItems: "center" } : {}}>
                    <Text style={s.glanceValue}>{g.value}</Text>
                    <Text style={s.glanceLabel}>{g.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {data.details.length ? (
          <Section title="Property details">
            <View style={s.card}>
              <FieldGrid fields={data.details} />
            </View>
          </Section>
        ) : null}

        {featured.length ? (
          <Section title="Features & amenities">
            <View style={s.amenityGrid}>
              {featured.map((a) => (
                <View key={a.name} style={s.amenityWrap} wrap={false}>
                  <View style={s.amenity}>
                    <View style={s.dot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.amenityName}>{a.name}</Text>
                      {a.note ? <Text style={s.amenityNote}>{a.note}</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {more.length ? (
              <View style={[s.chips, { marginTop: 2 }]} wrap={false}>
                <Text style={[s.label, { marginRight: 8, marginTop: 5 }]}>Also</Text>
                {more.map((a) => (
                  <Text key={a.name} style={s.chip}>
                    {a.name}
                  </Text>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        {data.description ? (
          <Section title="About this property" keep>
            <View style={s.card}>
              <Text style={s.paragraph}>{data.description}</Text>
            </View>
          </Section>
        ) : null}

        {hasStaff ? (
          <View style={s.staffCard} wrap={false}>
            <View style={s.staffHead}>
              <View style={s.sectionHead}>
                <View style={[s.sectionBar, { backgroundColor: C.charcoal }]} />
                <Text style={s.sectionTitle}>Staff information</Text>
              </View>
              <Text style={s.staffBadge}>DO NOT SHARE WITH CLIENTS</Text>
            </View>
            {data.owner.length ? <FieldGrid fields={data.owner} /> : null}
            {data.internal.length ? (
              <View style={{ marginTop: data.owner.length ? 4 : 0 }}>
                <FieldGrid fields={data.internal} />
              </View>
            ) : null}
            {data.internalComments ? (
              <View style={{ paddingVertical: 7 }}>
                <Text style={s.label}>Internal comments</Text>
                <Text style={[s.value, { fontFamily: "Helvetica" }]}>{data.internalComments}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Footer data={data} />
      </Page>

      {data.photos.length ? (
        <Page size="A4" style={s.page}>
          <Header data={data} logo={logo} />
          <View style={[s.galleryHead, { marginTop: 18 }]}>
            <View style={[s.sectionHead, { marginBottom: 0 }]}>
              <View style={s.sectionBar} />
              <Text style={s.sectionTitle}>Photo gallery</Text>
            </View>
            <Text style={s.galleryRef}>
              {data.eyebrow} {data.heading}
            </Text>
          </View>
          <View style={s.photoGrid}>
            {data.photos.map((p, i) => (
              <View key={i} style={s.photoWrap} wrap={false}>
                <View style={s.photoFrame}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
                  <Image style={s.photo} src={{ data: p.data, format: p.format }} />
                </View>
              </View>
            ))}
          </View>
          <Footer data={data} />
        </Page>
      ) : null}
    </Document>
  );
}

export function renderPropertyPdf(data: PropertyPdfData, logo: Buffer | null) {
  return renderToBuffer(<PropertyPdf data={data} logo={logo} />);
}
