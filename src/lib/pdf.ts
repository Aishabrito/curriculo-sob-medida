import { BULLET_RE, DEFAULT_PROFILE, fitProfile, lineSegments, scaleProfile, sizeScale, type Segment, type StyleProfile, type TextStyle } from "./layout";
import type { FinalResume } from "./resume";

// Gera o PDF final. Com o perfil padrão sai um PDF de uma coluna, só texto,
// que os filtros ATS leem bem. Com o perfil lido do PDF original, repete as
// fontes, tamanhos, negritos, cores, margens e marcadores do currículo da pessoa.
// Se o original tinha N páginas, a letra e as margens diminuem um pouco até
// o novo caber nas mesmas N páginas.

type Doc = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

/** Quanto a letra pode diminuir para caber (1 = tamanho original). */
const FIT_STEPS = [1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.73];

const fontStyle = (st: TextStyle, bold: boolean) => (bold && st.italic ? "bolditalic" : bold ? "bold" : st.italic ? "italic" : "normal");

/** Desenha o currículo no documento e devolve quantas páginas usou. */
function render(doc: Doc, resume: FinalResume, p: StyleProfile, plain: boolean): number {
  const margin = p.marginX;
  const width = p.pageWidth - margin * 2;
  const bottom = p.pageHeight - Math.max(28, p.marginTop);
  const gap = p.body.size * 0.2;
  let y = p.marginTop;
  let pages = 1;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage([p.pageWidth, p.pageHeight]);
      pages++;
      y = p.marginTop;
    }
  };

  const use = (st: TextStyle, bold = st.bold) => {
    doc.setFont(st.family, fontStyle(st, bold));
    doc.setFontSize(st.size);
    doc.setTextColor(...st.color);
  };

  const write = (text: string, st: TextStyle, gapAfter: number, opts: { indent?: number; center?: boolean } = {}) => {
    use(st);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lh = st.size * p.lineHeight;
    for (const line of lines) {
      ensure(lh);
      if (opts.center) doc.text(line, p.pageWidth / 2, y + st.size, { align: "center" });
      else doc.text(line, margin + indent, y + st.size);
      y += lh;
    }
    y += gapAfter;
  };

  /** Como write, mas com pedaços em negrito no meio (quebra palavra por palavra). */
  const writeRich = (segments: Segment[], st: TextStyle, gapAfter: number, indent = 0) => {
    const words = segments.flatMap((s) => s.text.split(/\s+/).filter(Boolean).map((text) => ({ text, bold: s.bold || st.bold })));
    const widthOf = (text: string, bold: boolean) => {
      use(st, bold);
      return doc.getStringUnitWidth(text) * st.size;
    };
    const max = width - indent;
    const rows: (typeof words)[] = [[]];
    let rowWidth = 0;
    for (const w of words) {
      const ww = widthOf(w.text, w.bold);
      const row = rows[rows.length - 1];
      const space = row.length ? widthOf(" ", w.bold) : 0;
      if (row.length && rowWidth + space + ww > max) {
        rows.push([w]);
        rowWidth = ww;
      } else {
        row.push(w);
        rowWidth += space + ww;
      }
    }
    const lh = st.size * p.lineHeight;
    for (const row of rows) {
      ensure(lh);
      let x = margin + indent;
      // Palavras seguidas com o mesmo peso saem num pedaço só (melhor para o ATS).
      for (let i = 0; i < row.length; ) {
        let j = i;
        while (j < row.length && row[j].bold === row[i].bold) j++;
        const text = row.slice(i, j).map((w) => w.text).join(" ") + (j < row.length ? " " : "");
        use(st, row[i].bold);
        doc.text(text, x, y + st.size);
        x += doc.getStringUnitWidth(text) * st.size;
        i = j;
      }
      y += lh;
    }
    y += gapAfter;
  };

  const center = p.centeredHeader;
  write(resume.name || "Currículo", p.name, gap, { center });
  if (resume.headline) write(resume.headline, p.headline, gap, { center });
  if (resume.contact.length) write(resume.contact.join("  |  "), p.contact, p.body.size, { center });

  for (const section of resume.sections) {
    ensure(p.heading.size * 3 + p.body.size * 2);
    y += p.body.size * 0.6;
    write(plain ? section.title.toUpperCase() : section.title, p.heading, p.headingRule ? 0 : gap * 1.5);
    if (p.headingRule) {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + 1, margin + width, y + 1);
      y += p.body.size * 0.8;
    }
    section.lines.forEach((raw, i) => {
      const id = section.lineIds[i];
      const hadBullet = id ? p.bulletedLines[id] : p.bulletedSections[section.id];
      const explicit = raw.match(BULLET_RE);
      const text = raw.replace(BULLET_RE, "");
      const segments = lineSegments(p, section.id, id, section.strong?.[i] ?? false, text);
      // Um respiro antes de cada novo item (experiência, curso, projeto).
      if (i > 0 && segments[0].bold && segments.length === 1) y += gap * 2;
      const mark = explicit ? (p.bullet ?? "•") : hadBullet && p.bullet ? p.bullet : null;
      if (mark) {
        ensure(p.body.size * p.lineHeight);
        use(p.body);
        doc.text(mark === "·" ? "•" : mark, margin + 2, y + p.body.size);
        writeRich(segments, p.body, gap, p.body.size * 1.4);
      } else {
        writeRich(segments, p.body, gap);
      }
    });
  }
  return pages;
}

/**
 * Monta o PDF. maxPages é o número de páginas do currículo original: o novo
 * diminui a letra até caber nelas.
 */
export async function buildResumePdf(resume: FinalResume, profile: StyleProfile = DEFAULT_PROFILE, maxPages?: number): Promise<{ doc: Doc; pages: number }> {
  const { jsPDF } = await import("jspdf");
  const plain = profile === DEFAULT_PROFILE;
  const newDoc = (p: StyleProfile): Doc => new jsPDF({ unit: "pt", format: [p.pageWidth, p.pageHeight] });
  const probe = newDoc(profile);
  const measure = (text: string, st: TextStyle) => {
    probe.setFont(st.family, st.bold ? "bold" : "normal");
    return probe.getStringUnitWidth(text) * st.size;
  };
  const base = plain ? profile : scaleProfile(profile, sizeScale(profile, measure));
  // Se nem com a letra menor couber, fica no tamanho original.
  const p = (maxPages && FIT_STEPS.map((k) => fitProfile(base, k)).find((f) => render(newDoc(f), resume, f, plain) <= maxPages)) || base;
  const doc = newDoc(p);
  return { doc, pages: render(doc, resume, p, plain) };
}

/** Baixa o PDF e devolve quantas páginas ele ficou. */
export async function downloadResumePdf(resume: FinalResume, fileName: string, profile: StyleProfile = DEFAULT_PROFILE, maxPages?: number): Promise<number> {
  const { doc, pages } = await buildResumePdf(resume, profile, maxPages);
  doc.save(fileName);
  return pages;
}
