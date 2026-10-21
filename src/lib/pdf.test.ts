import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../../shared/types";
import { buildStyleProfile, DEFAULT_PROFILE, lineSegments, type PdfLayout, type StyledLine } from "./layout";
import { buildResumePdf } from "./pdf";
import { buildFinalResume, dashPairs, type FinalResume } from "./resume";
import { humanize } from "./text";

describe("humanize", () => {
  it("tira o travessão de cargos e períodos", () => {
    expect(humanize("Gerente Administrativo — Associação Atlética (Mar 2024 — Jul. 2025)", true)).toBe("Gerente Administrativo | Associação Atlética (Mar 2024 a Jul. 2025)");
    expect(humanize("Consultora — Fluxo (Jan 2024 – Nov 2024). Desenvolvimento de apps")).toBe("Consultora, Fluxo (Jan 2024 a Nov 2024). Desenvolvimento de apps");
    expect(humanize("2022–2023")).toBe("2022 a 2023");
    expect(humanize("— Node.js e React")).toBe("Node.js e React");
    expect(humanize("Sem travessão - nada muda")).toBe("Sem travessão - nada muda");
  });
});

describe("negrito por linha", () => {
  it("título de item fica todo em negrito; rótulo só no rótulo", () => {
    expect(lineSegments(DEFAULT_PROFILE, "s1", "s1l1", true, "Pesquisadora | Jovens Cientistas")).toEqual([{ text: "Pesquisadora | Jovens Cientistas", bold: true }]);
    expect(lineSegments(DEFAULT_PROFILE, "s1", "s1l2", false, "Tecnologias: React, Node.js")).toEqual([
      { text: "Tecnologias:", bold: true },
      { text: "React, Node.js", bold: false },
    ]);
    expect(lineSegments(DEFAULT_PROFILE, "s1", "s1l3", false, "Atuação em squads com Scrum.")).toEqual([{ text: "Atuação em squads com Scrum.", bold: false }]);
  });

  it("copia do PDF original o que era negrito e deixa títulos de seção em negrito", () => {
    const line = (text: string, y: number, extra: Partial<StyledLine> = {}): StyledLine => ({ text, page: 1, x: 50, y, width: 300, size: 10, bold: false, italic: false, family: "times", color: [0, 0, 0], ...extra });
    const layout: PdfLayout = {
      pageWidth: 595,
      pageHeight: 842,
      pages: 1,
      lines: [
        line("Ana Souza", 60, { size: 18, bold: true }),
        line("EXPERIÊNCIA", 100, { size: 12 }),
        line("Gerente | Atlética (2024)", 116, { bold: true }),
        line("Gestão de processos internos.", 130),
        line("COMPETÊNCIAS", 160, { size: 12 }),
        line("Tecnologias: React", 176, { boldPrefix: "Tecnologias:" }),
      ],
    };
    const result = {
      candidate: { name: "Ana Souza", headline: "", contact: [] },
      sections: [
        { id: "s1", title: "EXPERIÊNCIA", lines: [{ id: "s1l1", text: "Gerente | Atlética (2024)" }, { id: "s1l2", text: "Gestão de processos internos." }] },
        { id: "s2", title: "COMPETÊNCIAS", lines: [{ id: "s2l1", text: "Tecnologias: React" }] },
      ],
    } as unknown as AnalysisResult;
    const p = buildStyleProfile(layout, result);
    expect(p.heading.bold).toBe(true);
    expect(p.body.bold).toBe(false);
    expect(lineSegments(p, "s1", "s1l1", false, "Gerente | Atlética (2024)")[0].bold).toBe(true);
    expect(lineSegments(p, "s1", "s1l2", false, "Gestão: processos")).toEqual([{ text: "Gestão: processos", bold: false }]);
    expect(lineSegments(p, "s2", "s2l1", false, "Tecnologias: React, Git")[0]).toEqual({ text: "Tecnologias:", bold: true });
  });
});

describe("PDF", () => {
  const long = "Desenvolvimento de soluções de software e aplicativos móveis em React Native para clientes reais, com foco em experiência do usuário e entregas semanais.";
  const resume = (n: number): FinalResume => ({
    name: "Ana Souza",
    headline: "Estudante de Engenharia",
    contact: ["ana@email.com", "(21) 99999-0000"],
    sections: [
      { id: "s1", title: "Experiência", lines: Array.from({ length: n }, (_, i) => (i % 3 ? long : `Cargo ${i} | Empresa (2024 a 2025)`)), lineIds: Array(n).fill(null), strong: Array.from({ length: n }, (_, i) => i % 3 === 0) },
    ],
  });

  it("diminui a letra para caber no mesmo número de páginas do original", async () => {
    expect((await buildResumePdf(resume(34))).pages).toBe(2);
    expect((await buildResumePdf(resume(34), DEFAULT_PROFILE, 1)).pages).toBe(1);
  });

  it("não espreme demais: se não couber de jeito nenhum, mantém o tamanho", async () => {
    const natural = (await buildResumePdf(resume(120))).pages;
    expect((await buildResumePdf(resume(120), DEFAULT_PROFILE, 1)).pages).toBe(natural);
  });
});

describe("currículo final sem travessão", () => {
  it("limpa linhas originais e as do Word", () => {
    const result = {
      candidate: { name: "Ana", headline: "Dev — Front-end", contact: [] },
      sections: [{ id: "s1", title: "Experiência", lines: [{ id: "s1l1", text: "Consultora — Fluxo (Jan 2024 — Nov 2024)", strong: true }] }],
      suggestions: [],
    } as unknown as AnalysisResult;
    const final = buildFinalResume(result, {});
    expect(final.headline).toBe("Dev, Front-end");
    expect(final.sections[0].lines[0]).toBe("Consultora | Fluxo (Jan 2024 a Nov 2024)");
    expect(final.sections[0].strong).toEqual([true]);
    expect(dashPairs(result)).toHaveLength(2);
  });
});
