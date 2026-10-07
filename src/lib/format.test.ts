import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../../shared/types";
import { patchDocx } from "./docx";
import { checkEvidence } from "./evidence";
import { buildStyleProfile, type PdfLayout, type StyledLine } from "./layout";

const result: AnalysisResult = {
  jobTitle: "Estágio",
  companyName: "X",
  candidate: { name: "Ana Souza", headline: "Estudante de SI", contact: ["ana@email.com"] },
  sections: [
    { id: "s1", title: "Projetos", lines: [
      { id: "s1l1", text: "Feira Livre: site em React com dados da prefeitura." },
      { id: "s1l2", text: "Portfólio em HTML e CSS." },
    ] },
    { id: "s2", title: "Habilidades", lines: [{ id: "s2l1", text: "React, JavaScript, Git" }] },
  ],
  suggestions: [
    { id: "m1", sectionId: "s1", lineId: "s1l1", original: "", suggested: "Feira Livre (React.js): app com dados abertos da prefeitura.", reason: "", evidence: "", requirement: "" },
    { id: "m2", sectionId: "s1", lineId: null, original: "", suggested: "App de gastos em React com gráficos.", reason: "", evidence: "", requirement: "" },
    { id: "m3", sectionId: "resumo", lineId: null, original: "", suggested: "Estudante de SI que constrói interfaces em React.", reason: "", evidence: "", requirement: "" },
    { id: "m4", sectionId: "s2", lineId: "s2l1", original: "", suggested: "React.js, JavaScript (ES6+), Git e GitHub", reason: "", evidence: "", requirement: "" },
  ],
  keywords: [], gaps: [], companyBridge: null, recruiterMessage: "", interviewQuestions: [],
};
const all = Object.fromEntries(result.suggestions.map((s) => [s.id, { decision: "aceita" as const }]));

const run = (t: string, rpr = "") => `<w:r>${rpr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const bold = "<w:rPr><w:b/><w:color w:val=\"1F3D2B\"/></w:rPr>";
const bulletP = (inner: string) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${inner}</w:p>`;
const docXml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p>${run("Ana Souza", bold)}</w:p><w:p>${run("Estudante de SI")}</w:p><w:p>${run("ana@email.com")}</w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Projetos", bold)}</w:p>
${bulletP(run("Feira Livre:", bold) + run(" site em React com dados da prefeitura."))}
${bulletP(run("Portfólio em HTML e CSS."))}
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Habilidades", bold)}</w:p>
<w:p>${run("React, JavaScript, Git")}</w:p>
</w:body></w:document>`;

async function makeDocx() {
  const zip = new JSZip();
  zip.file("word/document.xml", docXml);
  return zip.generateAsync({ type: "uint8array" });
}

describe("patchDocx", () => {
  it("troca o texto mantendo a formatação, copia parágrafos para linhas e seções novas", async () => {
    const { data, report } = await patchDocx(await makeDocx(), result, all);
    expect(report).toEqual({ applied: 4, missed: [] });
    const xml = await (await JSZip.loadAsync(data)).file("word/document.xml")!.async("string");
    const paras = [...xml.matchAll(/<w:p>[\s\S]*?<\/w:p>|<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
    const texts = paras.map((p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""));
    expect(texts).toEqual([
      "Ana Souza",
      "Estudante de SI",
      "ana@email.com",
      "Resumo profissional",
      "Estudante de SI que constrói interfaces em React.",
      "Projetos",
      "Feira Livre (React.js): app com dados abertos da prefeitura.",
      "Portfólio em HTML e CSS.",
      "App de gastos em React com gráficos.",
      "Habilidades",
      "React.js, JavaScript (ES6+), Git e GitHub",
    ]);
    // A linha nova herdou o marcador (numPr) e o título novo herdou o estilo de título.
    expect(paras[8]).toContain("<w:numId w:val=\"1\"/>");
    expect(paras[3]).toContain("Heading1");
    // O rótulo em negrito continua em negrito; o texto novo entra no pedaço sem negrito.
    const runs = [...paras[6].matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)].map((m) => m[1]);
    expect(runs[0]).toContain("1F3D2B");
    expect(runs[0]).toMatch(/<w:t[^>]*>Feira Livre<\/w:t>/);
    expect(runs[1]).not.toContain("<w:b/>");
    expect(runs[1]).toMatch(/<w:t[^>]*> \(React\.js\): app com dados abertos da prefeitura\.<\/w:t>/);
  });

  it("avisa o que não encontrou", async () => {
    const odd = { ...result, sections: [{ id: "s1", title: "Projetos", lines: [{ id: "s1l1", text: "Linha que não existe no arquivo" }] }] };
    const { report } = await patchDocx(await makeDocx(), odd, { m1: { decision: "aceita" } });
    expect(report.missed).toHaveLength(1);
  });
});

describe("buildStyleProfile", () => {
  const L = (text: string, y: number, size: number, extra: Partial<StyledLine> = {}): StyledLine => ({
    text, page: 1, x: 50, y, width: 200, size, bold: false, italic: false, family: "times", color: [20, 20, 20], ...extra,
  });
  const layout: PdfLayout = {
    pageWidth: 612, pageHeight: 792,
    lines: [
      L("Ana Souza", 60, 22, { bold: true, x: 256, width: 100, color: [31, 61, 43] }),
      L("Estudante de SI", 80, 12, { x: 260, width: 92 }),
      L("ana@email.com", 96, 9, { x: 270, width: 72 }),
      L("Projetos", 130, 13, { bold: true, color: [31, 61, 43] }),
      L("• Feira Livre: site em React com dados", 148, 10.5),
      L("da prefeitura.", 162, 10.5),
      L("• Portfólio em HTML e CSS.", 176, 10.5),
      L("Habilidades", 205, 13, { bold: true, color: [31, 61, 43] }),
      L("React, JavaScript, Git", 223, 10.5),
    ],
  };

  it("lê fonte, tamanhos, cores, alinhamento e marcadores do original", () => {
    const p = buildStyleProfile(layout, result);
    expect(p.name).toMatchObject({ size: 22, bold: true, family: "times", color: [31, 61, 43] });
    expect(p.heading).toMatchObject({ size: 13, bold: true, color: [31, 61, 43] });
    expect(p.body).toMatchObject({ size: 10.5, bold: false, family: "times" });
    expect(p.centeredHeader).toBe(true);
    expect(p.bullet).toBe("•");
    expect(p.bulletedLines).toEqual({ s1l1: true, s1l2: true, s2l1: false });
    expect(p.bulletedSections).toEqual({ s1: true, s2: false });
    expect(p.marginX).toBe(50);
    expect(p.lineHeight).toBeCloseTo(14 / 10.5, 1);
  });
});

describe("sizeScale", () => {
  it("aumenta quando a fonte original é mais larga e não ajusta duas vezes", async () => {
    const { sizeScale, scaleProfile } = await import("./layout");
    const base = buildStyleProfile(
      { pageWidth: 612, pageHeight: 792, lines: [
        { text: "Ana Souza", page: 1, x: 50, y: 60, width: 100, size: 20, bold: true, italic: false, family: "times", color: [0, 0, 0] },
        { text: "Projetos legais", page: 1, x: 50, y: 100, width: 120, size: 10, bold: false, italic: false, family: "times", color: [0, 0, 0] },
        { text: "Mais um texto qualquer", page: 1, x: 50, y: 114, width: 180, size: 10, bold: false, italic: false, family: "times", color: [0, 0, 0] },
      ] },
      { ...result, sections: [{ id: "s1", title: "Nada", lines: [{ id: "a", text: "Projetos legais" }, { id: "b", text: "Mais um texto qualquer" }] }] },
    );
    const measure = (t: string, st: { size: number }) => t.length * st.size * 0.6; // fonte "estreita"
    const k = sizeScale(base, measure);
    expect(k).toBeGreaterThan(1.2);
    const scaled = scaleProfile(base, k);
    expect(scaled.body.size).toBeCloseTo(10 * k, 1);
    expect(sizeScale(scaled, measure)).toBe(1);
  });
});

describe("evidência vinda do campo extra", () => {
  it("diferencia currículo, relato e invenção", () => {
    const cv = "Fiz o Feira Livre em React.";
    const extra = "Terminei o curso de TypeScript da Alura em setembro.";
    expect(checkEvidence("Feira Livre em React", cv, extra)).toBe("verificada");
    expect(checkEvidence("curso de TypeScript da Alura", cv, extra)).toBe("do-relato");
    expect(checkEvidence("certificação AWS", cv, extra)).toBe("sem-evidencia");
  });
});
