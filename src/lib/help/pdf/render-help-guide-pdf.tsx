import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { HelpAccent, HelpBlock, HelpChapter, HelpGuideMeta } from "@/lib/help/types";

const ACCENTS: Record<HelpAccent, { badgeBg: string; heading: string }> = {
  blue: { badgeBg: "#2563eb", heading: "#2563eb" },
  purple: { badgeBg: "#7c3aed", heading: "#7c3aed" },
  teal: { badgeBg: "#0d9488", heading: "#0d9488" },
};

const CALLOUT_STYLES: Record<
  string,
  { bg: string; border: string; labelColor: string }
> = {
  note: { bg: "#eff6ff", border: "#2563eb", labelColor: "#1d4ed8" },
  tip: { bg: "#ecfdf5", border: "#059669", labelColor: "#047857" },
  warning: { bg: "#fffbeb", border: "#d97706", labelColor: "#b45309" },
  danger: { bg: "#fef2f2", border: "#dc2626", labelColor: "#b91c1c" },
  exclusive: { bg: "#f5f3ff", border: "#7c3aed", labelColor: "#6d28d9" },
};

const styles = StyleSheet.create({
  coverPage: { backgroundColor: "#0f172a", color: "#ffffff", padding: 56, fontFamily: "Helvetica" },
  coverEyebrow: { fontSize: 9, letterSpacing: 2, color: "#94a3b8", marginBottom: 40 },
  coverBadge: {
    alignSelf: "flex-start",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 34, marginBottom: 16 },
  coverDescription: { fontSize: 12, lineHeight: 1.5, color: "#cbd5e1", maxWidth: 380 },
  coverFooterRow: {
    position: "absolute",
    bottom: 56,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 12,
  },
  coverFooterText: { fontSize: 9, color: "#94a3b8" },
  tocPage: { padding: 56, fontFamily: "Helvetica", color: "#0f172a" },
  tocTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, marginBottom: 24 },
  tocRow: { marginBottom: 14 },
  tocNumber: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  tocChapterTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 2 },
  tocChapterDesc: { fontSize: 9.5, color: "#64748b", marginTop: 2 },
  chapterPage: {
    padding: 48,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    color: "#0f172a",
    fontSize: 10,
    lineHeight: 1.45,
  },
  chapterEyebrow: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginBottom: 6 },
  chapterTitle: { fontFamily: "Helvetica-Bold", fontSize: 20, marginBottom: 8 },
  chapterIntro: { fontSize: 10.5, color: "#334155", marginBottom: 14 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginBottom: 16 },
  sectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 14, marginBottom: 6 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 8, color: "#1e293b" },
  code: { fontFamily: "Courier", fontSize: 9, backgroundColor: "#f1f5f9", color: "#0f172a" },
  stepRow: { flexDirection: "row", marginBottom: 8 },
  stepBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 3,
    marginRight: 8,
  },
  stepText: { fontSize: 10, lineHeight: 1.45, flex: 1, color: "#1e293b" },
  table: { marginTop: 4, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#0f172a" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  tableRowAlt: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  th: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#ffffff", padding: 6 },
  td: { fontSize: 9, color: "#1e293b", padding: 6, lineHeight: 1.4 },
  tdMono: { fontSize: 8.5, fontFamily: "Courier", color: "#0f172a", padding: 6 },
  cardBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
  },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 3 },
  cardText: { fontSize: 8.5, color: "#475569", lineHeight: 1.35 },
  calloutBox: { borderLeftWidth: 3, borderRadius: 3, padding: 10, marginBottom: 12, marginTop: 4 },
  calloutLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 0.5, marginBottom: 4 },
  calloutText: { fontSize: 9.5, lineHeight: 1.45, color: "#1e293b" },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
});

function renderTextWithCode(text: string, baseStyle: Style, codeStyle: Style = styles.code) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={[baseStyle, codeStyle]}>
        {" "}
        {part}{" "}
      </Text>
    ) : (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    )
  );
}

function BlockView({ block, accent }: { block: HelpBlock; accent: HelpAccent }) {
  const a = ACCENTS[accent];
  switch (block.type) {
    case "sectionHeading":
      return <Text style={[styles.sectionHeading, { color: a.heading }]}>{block.text}</Text>;
    case "paragraph":
      return <Text style={styles.paragraph}>{renderTextWithCode(block.text, styles.paragraph)}</Text>;
    case "steps":
      return (
        <View>
          {block.items.map((item, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={[styles.stepBadge, { backgroundColor: a.badgeBg }]}>{i + 1}</Text>
              <Text style={styles.stepText}>{renderTextWithCode(item, styles.stepText)}</Text>
            </View>
          ))}
        </View>
      );
    case "callout": {
      const c = CALLOUT_STYLES[block.kind];
      return (
        <View style={[styles.calloutBox, { backgroundColor: c.bg, borderLeftColor: c.border }]}>
          <Text style={[styles.calloutLabel, { color: c.labelColor }]}>{block.label}</Text>
          <Text style={styles.calloutText}>{renderTextWithCode(block.text, styles.calloutText)}</Text>
        </View>
      );
    }
    case "table":
      return (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {block.columns.map((c, i) => (
              <Text key={i} style={[styles.th, { width: `${block.widths[i]}%` }]}>
                {c}
              </Text>
            ))}
          </View>
          {block.rows.map((row, ri) => (
            <View key={ri} style={ri % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
              {row.map((cell, ci) => (
                <Text
                  key={ci}
                  style={[ci === 0 ? styles.tdMono : styles.td, { width: `${block.widths[ci]}%` }]}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "cards":
      return (
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          {block.items.map((item, i) => (
            <View key={i} style={[styles.cardBox, i === block.items.length - 1 ? { marginRight: 0 } : {}]}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.text}</Text>
            </View>
          ))}
        </View>
      );
  }
}

function PageFooter({ edition }: { edition: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>ZEBL AMS</Text>
      <Text render={({ pageNumber, totalPages }) => `${edition} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function GuideDocument({ meta, chapters }: { meta: HelpGuideMeta; chapters: HelpChapter[] }) {
  const a = ACCENTS[meta.accent];
  return (
    <Document title={`ZEBL AMS — ${meta.roleLabel} User Guide`} author="ZEBL AMS">
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverEyebrow}>Z E B L   ·   A T T E N D A N C E   &   H R   P L A T F O R M</Text>
        <Text style={[styles.coverBadge, { backgroundColor: a.badgeBg }]}>{meta.roleLabel.toUpperCase()}</Text>
        <Text style={styles.coverTitle}>User Guide</Text>
        <Text style={styles.coverDescription}>{meta.coverDescription}</Text>
        <View style={styles.coverFooterRow}>
          <Text style={styles.coverFooterText}>ZEBL AMS</Text>
          <Text style={styles.coverFooterText}>
            {meta.edition} · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.tocPage}>
        <Text style={styles.tocTitle}>Contents</Text>
        {chapters.map((c) => (
          <View key={c.number} style={styles.tocRow}>
            <Text style={[styles.tocNumber, { color: a.heading }]}>
              {c.number} {c.tag ? `· ${c.tag}` : ""}
            </Text>
            <Text style={styles.tocChapterTitle}>{c.title}</Text>
            <Text style={styles.tocChapterDesc}>{c.intro}</Text>
          </View>
        ))}
      </Page>

      {chapters.map((c) => (
        <Page key={c.number} size="A4" style={styles.chapterPage} wrap>
          <Text style={[styles.chapterEyebrow, { color: a.heading }]}>
            CHAPTER {c.number}
            {c.tag ? ` · ${c.tag.toUpperCase()}` : ""}
          </Text>
          <Text style={styles.chapterTitle}>{c.title}</Text>
          <Text style={styles.chapterIntro}>{c.intro}</Text>
          <View style={styles.hr} />
          {c.blocks.map((b, i) => (
            <BlockView key={i} block={b} accent={meta.accent} />
          ))}
          <PageFooter edition={meta.edition} />
        </Page>
      ))}

      <Page size="A4" style={[styles.chapterPage, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.tocNumber, { color: a.heading, textAlign: "center" }]}>ZEBL AMS</Text>
        <Text style={{ marginTop: 6, fontSize: 10, color: "#64748b" }}>
          End of the {meta.roleLabel} User Guide.
        </Text>
      </Page>
    </Document>
  );
}

/** Renders a role's help guide to a PDF buffer, server-side only. */
export async function renderHelpGuidePdf(meta: HelpGuideMeta, chapters: HelpChapter[]): Promise<Buffer> {
  // GuideDocument's root render output is a <Document>, but its own component
  // type isn't literally DocumentProps — renderToBuffer only cares about the
  // rendered tree, so this cast is safe (same pattern as the offer-letter renderer).
  const element = React.createElement(GuideDocument, { meta, chapters }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
