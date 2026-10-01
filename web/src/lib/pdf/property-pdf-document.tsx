import {
  Document,
  Font,
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
  PdfCopy,
  PdfField,
  PropertyPdfData,
} from "@/lib/pdf/property-pdf-data";

type Palette = {
  accent: string;
  priceAccent: string;
  accentPale: string;
  charcoal: string;
  ink: string;
  muted: string;
  line: string;
  bg: string;
  white: string;
};

const BRANDED: Palette = {
  accent: "#ef2016",
  priceAccent: "#bb120b",
  accentPale: "#fdebe8",
  charcoal: "#172230",
  ink: "#2e2e2e",
  muted: "#70798a",
  line: "#dedbd4",
  bg: "#f7f3eb",
  white: "#ffffff",
};

const PAD_X = 36;
const PAD_TOP = 28;
const FOOTER_H = 50;
Font.registerHyphenationCallback((word) => [word]);

function makeStyles(C: Palette) {
  return StyleSheet.create({
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
    accentBar: { marginHorizontal: -PAD_X, height: 3, backgroundColor: C.accent },
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

    hero: { flexDirection: "row", alignItems: "center", marginTop: 16 },
    heroLeft: { flex: 1, paddingRight: 18 },
    eyebrow: {
      fontFamily: "Helvetica-Bold",
      fontSize: 9.5,
      color: C.accent,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    heading: { fontFamily: "Times-Bold", fontSize: 25, color: C.charcoal, marginTop: 6, lineHeight: 1.15 },
    priceCard: {
      width: 180,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: C.priceAccent,
      alignItems: "center",
    },
    priceLabel: { fontSize: 7.5, color: "#ffffffcc", letterSpacing: 1.4, textTransform: "uppercase" },
    price: { fontFamily: "Helvetica-Bold", fontSize: 19, color: C.white, lineHeight: 1.1, marginTop: 5 },
    priceNote: { fontSize: 8, color: "#ffffffcc", marginTop: 4 },

    section: { marginTop: 12 },
    sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    sectionBar: { width: 3, height: 11, borderRadius: 1, backgroundColor: C.accent, marginRight: 7 },
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
      backgroundColor: C.accentPale,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },
    glanceValue: { fontFamily: "Helvetica-Bold", fontSize: 14, color: C.accent, lineHeight: 1.1 },
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
      minHeight: 26,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 8 },
    amenityName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: C.ink },
    paragraph: { fontSize: 10, color: C.ink, paddingVertical: 7, lineHeight: 1.45 },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: FOOTER_H,
      paddingHorizontal: PAD_X,
      backgroundColor: C.accent,
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
    plainFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: FOOTER_H,
      paddingHorizontal: PAD_X,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    plainFooterRule: {
      position: "absolute",
      left: PAD_X,
      right: PAD_X,
      top: 10,
      height: 1,
      backgroundColor: C.line,
    },
    plainFooterText: { fontSize: 7.5, color: C.muted, letterSpacing: 0.4 },

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
}

type Theme = { C: Palette; s: ReturnType<typeof makeStyles> };

const BRANDED_THEME: Theme = { C: BRANDED, s: makeStyles(BRANDED) };

const THEMES: Record<PdfCopy, Theme> = {
  client: BRANDED_THEME,
  agent: BRANDED_THEME,
};

function Icon({ name, t }: { name: GlanceIcon; t: Theme }) {
  const stroke = {
    stroke: t.C.accent,
    strokeWidth: 2,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
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
  t,
  keep = false,
  children,
}: {
  title: string;
  t: Theme;
  keep?: boolean;
  children: ReactNode;
}) {
  const { s } = t;
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

function FieldGrid({ fields, t, columns = 3 }: { fields: PdfField[]; t: Theme; columns?: number }) {
  const { s } = t;
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

function Footer({ data, t }: { data: PropertyPdfData; t: Theme }) {
  const { s } = t;
  if (data.copy === "agent") {
    return (
      <View style={s.plainFooter} fixed>
        <View style={s.plainFooterRule} />
        <Text style={s.plainFooterText}>Property details · {data.generatedAt}</Text>
      </View>
    );
  }
  return (
    <View style={s.footer} fixed>
      <View>
        <Text style={s.footName}>{data.company.name.toUpperCase()}</Text>
        <Text style={s.footText}>{data.company.address}</Text>
      </View>
      <View>
        <Text style={s.footPhoneLabel}>TELEPHONE</Text>
        <FooterPhone phone={data.company.phone} t={t} />
      </View>
    </View>
  );
}

function FooterPhone({ phone, t }: { phone: string; t: Theme }) {
  const { s, C } = t;
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

function Header({ data, logo, t }: { data: PropertyPdfData; logo: Buffer | null; t: Theme }) {
  const { s } = t;
  if (data.copy === "agent") {
    return (
      <>
        <View style={s.header} fixed>
          <View>
            <Text style={s.brandName}>PROPERTY DETAILS</Text>
            <Text style={s.brandSub}>{data.eyebrow.replace(/\s+in$/, "").toUpperCase()}</Text>
          </View>
          <View style={s.headRight}>
            <Text style={s.refPill}>{data.refNo}</Text>
            <Text style={s.headDate}>{data.generatedAt}</Text>
          </View>
        </View>
        <View style={s.accentBar} fixed />
      </>
    );
  }
  return (
    <>
      <View style={s.header} fixed>
        <View style={s.brand}>
          {logo ? (
            <View style={s.logoTile}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
              <Image style={s.logo} src={{ data: logo, format: "png" }} />
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
        </View>
      </View>
      <View style={s.accentBar} fixed />
    </>
  );
}

function PriceCard({ data, t }: { data: PropertyPdfData; t: Theme }) {
  const { s } = t;
  if (!data.price) return null;
  return (
    <View style={s.priceCard}>
      <Text style={s.priceLabel}>{data.priceLabel}</Text>
      <Text style={s.price}>{data.price}</Text>
      {data.priceSuffix ? <Text style={s.priceNote}>per month</Text> : null}
      {data.priceNote ? <Text style={s.priceNote}>{data.priceNote}</Text> : null}
    </View>
  );
}

function PropertyPdf({ data, logo }: { data: PropertyPdfData; logo: Buffer | null }) {
  const t = THEMES[data.copy];
  const { s } = t;
  const branded = data.copy === "client";
  const stacked = data.glance.length > 4;

  return (
    <Document
      title={`${data.refNo} · ${data.eyebrow} ${data.heading}`}
      author={branded ? data.company.name : undefined}
      creator={branded ? "Central7 Pulse" : "Property details"}
      producer={branded ? undefined : "Property details"}
      subject="Property details"
    >
      <Page size="A4" style={s.page}>
        <Header data={data} logo={logo} t={t} />

        <View style={s.hero} wrap={false}>
          <View style={s.heroLeft}>
            <Text style={s.eyebrow}>{data.eyebrow}</Text>
            <Text style={s.heading}>{data.heading}</Text>
          </View>
          <PriceCard data={data} t={t} />
        </View>

        {data.glance.length ? (
          <Section title="Property at a glance" t={t} keep>
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
                    <Icon name={g.icon} t={t} />
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
          <Section title="Property details" t={t}>
            <View style={s.card}>
              <FieldGrid fields={data.details} t={t} />
            </View>
          </Section>
        ) : null}

        {data.amenities.length ? (
          <Section title="Features & amenities" t={t}>
            <View style={s.amenityGrid}>
              {data.amenities.map((a) => (
                <View key={a.name} style={s.amenityWrap} wrap={false}>
                  <View style={s.amenity}>
                    <View style={s.dot} />
                    <Text style={[s.amenityName, { flex: 1 }]}>{a.name}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {data.description ? (
          <Section title={branded ? "Other information" : "About this property"} t={t}>
            <View style={s.card}>
              <Text style={s.paragraph}>{data.description}</Text>
            </View>
          </Section>
        ) : null}

        {branded && data.contact ? (
          <View style={[s.card, { marginTop: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.label}>Contact {data.contact.name}</Text>
              <Link
                src={whatsappHref(data.contact.phone) || `tel:${data.contact.phone.replace(/\s/g, "")}`}
                style={[s.value, { fontSize: 12, marginTop: 5, textDecoration: "none" }]}
              >
                {data.contact.phone}
              </Link>
            </View>
            {data.price ? (
              <View style={{ alignItems: "flex-end", maxWidth: "55%" }}>
                <Text style={s.label}>{data.priceSuffix ? "Rent" : "Price"}</Text>
                <Text style={[s.value, { color: t.C.accent, fontSize: 12, marginTop: 5 }]}>
                  {data.price}{data.priceSuffix ? ` ${data.priceSuffix}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {data.photos.length ? (
          <View style={{ marginTop: 18 }}>
            {Array.from({ length: Math.ceil(data.photos.length / 2) }, (_, row) => (
              <View key={row} wrap={false}>
                {row === 0 ? (
                  <View style={s.galleryHead}>
                    <View style={[s.sectionHead, { marginBottom: 0 }]}>
                      <View style={s.sectionBar} />
                      <Text style={s.sectionTitle}>Photo gallery</Text>
                    </View>
                    <Text style={s.galleryRef}>
                      {data.eyebrow} {data.heading}
                    </Text>
                  </View>
                ) : null}
                <View style={s.photoGrid}>
                  {data.photos.slice(row * 2, row * 2 + 2).map((p, i) => (
                    <View key={i} style={s.photoWrap}>
                      <View style={s.photoFrame}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
                        <Image style={s.photo} src={{ data: p.data, format: p.format }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Footer data={data} t={t} />
      </Page>
    </Document>
  );
}

export function renderPropertyPdf(data: PropertyPdfData, logo: Buffer | null) {
  return renderToBuffer(<PropertyPdf data={data} logo={logo} />);
}
