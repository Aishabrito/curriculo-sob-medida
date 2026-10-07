import type { FinalResume } from "./resume";

// PDF de uma coluna, só texto, fontes padrão: é o formato que os filtros ATS
// leem melhor. Nada de tabelas, ícones ou colunas.

const BULLET = /^[-•*▪●◦]\s*/;

export async function downloadResumePdf(resume: FinalResume, fileName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (text: string, size: number, style: "normal" | "bold", gap: number, indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, margin + indent, y + size);
      y += lh;
    }
    y += gap;
  };

  doc.setTextColor(20, 20, 20);
  write(resume.name || "Currículo", 20, "bold", 2);
  if (resume.headline) write(resume.headline, 11.5, "normal", 2);
  if (resume.contact.length) {
    doc.setTextColor(70, 70, 70);
    write(resume.contact.join("  |  "), 9.5, "normal", 10);
    doc.setTextColor(20, 20, 20);
  }

  for (const section of resume.sections) {
    ensure(40);
    y += 6;
    write(section.title.toUpperCase(), 10.5, "bold", 0);
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y + 1, margin + width, y + 1);
    y += 8;
    for (const line of section.lines) {
      if (BULLET.test(line)) {
        ensure(14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("•", margin + 2, y + 10);
        write(line.replace(BULLET, ""), 10, "normal", 3, 14);
      } else {
        write(line, 10, "normal", 3);
      }
    }
  }

  doc.save(fileName);
}
