import { BULLET_RE, DEFAULT_PROFILE, scaleProfile, sizeScale, type StyleProfile, type TextStyle } from "./layout";
import type { FinalResume } from "./resume";

// Gera o PDF final. Com o perfil padrão sai um PDF de uma coluna, só texto,
// que os filtros ATS leem bem. Com o perfil lido do PDF original, repete as
// fontes, tamanhos, negritos, cores, margens e marcadores do currículo da pessoa.

type Doc = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

export async function downloadResumePdf(resume: FinalResume, fileName: string, profile: StyleProfile = DEFAULT_PROFILE): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc: Doc = new jsPDF({ unit: "pt", format: [profile.pageWidth, profile.pageHeight] });
  const measure = (text: string, st: TextStyle) => {
    doc.setFont(st.family, st.bold ? "bold" : "normal");
    return doc.getStringUnitWidth(text) * st.size;
  };
  const p = profile === DEFAULT_PROFILE ? profile : scaleProfile(profile, sizeScale(profile, measure));
  const margin = p.marginX;
  const width = p.pageWidth - margin * 2;
  const bottom = p.pageHeight - Math.max(40, p.marginTop);
  let y = p.marginTop;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage([p.pageWidth, p.pageHeight]);
      y = p.marginTop;
    }
  };

  const use = (st: TextStyle) => {
    doc.setFont(st.family, st.bold && st.italic ? "bolditalic" : st.bold ? "bold" : st.italic ? "italic" : "normal");
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

  const center = p.centeredHeader;
  write(resume.name || "Currículo", p.name, 2, { center });
  if (resume.headline) write(resume.headline, p.headline, 2, { center });
  if (resume.contact.length) write(resume.contact.join("  |  "), p.contact, 10, { center });

  for (const section of resume.sections) {
    ensure(p.heading.size * 3 + p.body.size * 2);
    y += p.body.size * 0.6;
    write(profile === DEFAULT_PROFILE ? section.title.toUpperCase() : section.title, p.heading, p.headingRule ? 0 : 3);
    if (p.headingRule) {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + 1, margin + width, y + 1);
      y += 8;
    }
    section.lines.forEach((raw, i) => {
      const id = section.lineIds[i];
      const hadBullet = id ? p.bulletedLines[id] : p.bulletedSections[section.id];
      const explicit = raw.match(BULLET_RE);
      const text = raw.replace(BULLET_RE, "");
      const mark = explicit ? (p.bullet ?? "•") : hadBullet && p.bullet ? p.bullet : null;
      if (mark) {
        const indent = p.body.size * 1.4;
        ensure(p.body.size * p.lineHeight);
        use(p.body);
        doc.text(mark === "·" ? "•" : mark, margin + 2, y + p.body.size);
        write(text, p.body, 2, { indent });
      } else {
        write(text, p.body, 2);
      }
    });
  }

  doc.save(fileName);
}
