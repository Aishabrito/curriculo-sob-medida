import { describe, expect, it } from "vitest";
import { analyze, HttpError } from "../../server/analyze";
import { extractJson, parseAnalysis } from "../../shared/parseAnalysis";
import { demoInput, demoResult } from "../demo/example";
import { atsReport } from "./ats";
import { findCliches, highlightCliches, humanScore } from "./cliches";
import { checkEvidence } from "./evidence";
import { buildFinalResume, resumeToText } from "./resume";

describe("checkEvidence", () => {
  it("aceita trecho literal mesmo com acento e pontuação diferentes", () => {
    expect(checkEvidence("usando dados da prefeitura em JSON", demoInput.resume)).toBe("verificada");
    expect(checkEvidence("USANDO DADOS DA PREFEITURA, EM json", demoInput.resume)).toBe("verificada");
  });

  it("rejeita prova inventada", () => {
    expect(checkEvidence("projetos com TypeScript", demoInput.resume)).toBe("sem-evidencia");
    expect(checkEvidence("", demoInput.resume)).toBe("sem-evidencia");
  });

  it("todas as sugestões do exemplo têm prova, menos a inventada de propósito", () => {
    const status = demoResult.suggestions.map((s) => [s.id, checkEvidence(s.evidence, demoInput.resume)]);
    expect(status.filter(([, st]) => st === "sem-evidencia").map(([id]) => id)).toEqual(["m8"]);
  });
});

describe("atsReport", () => {
  it("melhora a cobertura quando as mudanças aceitas trazem termos da vaga", () => {
    const decisions = Object.fromEntries(demoResult.suggestions.map((s) => [s.id, { decision: "aceita" as const }]));
    const finalText = resumeToText(buildFinalResume(demoResult, decisions));
    const report = atsReport(demoInput.resume, finalText, demoResult.keywords);
    expect(report.after).toBeGreaterThan(report.before);
    const status = Object.fromEntries(report.keywords.map((k) => [k.keyword.term, k.status]));
    expect(status["React.js"]).toBe("tinha");
    expect(status["layout responsivo"]).toBe("adicionada");
    expect(status["Figma"]).toBe("faltando");
  });
});

describe("clichês", () => {
  it("encontra e destaca clichês", () => {
    const text = "Sou proativa e apaixonada por tecnologia.";
    expect(findCliches(text).map((c) => c.label)).toEqual(["proativo(a)", "apaixonado(a) por"]);
    expect(highlightCliches(text).filter((p) => p.cliche).map((p) => p.text)).toEqual(["proativa", "apaixonada por"]);
    expect(highlightCliches(text).map((p) => p.text).join("")).toBe(text);
  });

  it("texto factual tem nota maior", () => {
    expect(humanScore("Criei um app em React que mostra feiras de Niterói.")).toBe(100);
    expect(humanScore("Sou proativa, dinâmica e resiliente.")).toBeLessThan(80);
  });
});

describe("buildFinalResume", () => {
  it("aplica só as aceitas, respeita edição e adiciona linhas novas", () => {
    const final = buildFinalResume(demoResult, {
      m2: { decision: "aceita" },
      m3: { decision: "recusada" },
      m4: { decision: "aceita", edited: "Portfólio em HTML, CSS e JS no GitHub Pages." },
      m8: { decision: "aceita" },
    });
    const projetos = final.sections.find((s) => s.title === "Projetos")!;
    expect(projetos.lines[0]).toContain("Feira Livre Online (React.js)");
    expect(projetos.lines[1]).toBe("Portfólio em HTML, CSS e JS no GitHub Pages.");
    expect(projetos.lines[2]).toBe(demoResult.sections[2].lines[2].text);
    expect(projetos.lines).toHaveLength(4);
  });
});

describe("parseAnalysis", () => {
  it("lê JSON embrulhado em markdown e descarta campos quebrados", () => {
    const raw = extractJson('```json\n{"sections":[{"id":"s1","title":"Projetos","lines":[{"id":"a","text":"X"}]}],"suggestions":[{"id":"m1","sectionId":"s1","lineId":"nao-existe","original":"","suggested":"Y"},{"suggested":""}],"keywords":[{"term":"React","importance":"Essencial"},{"term":"react"}]}\n```');
    const r = parseAnalysis(raw);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].lineId).toBeNull();
    expect(r.keywords).toEqual([{ term: "React", importance: "essencial", synonyms: [] }]);
    expect(r.companyBridge).toBeNull();
  });

  it("recusa resposta sem seções", () => {
    expect(() => parseAnalysis({ sections: [] })).toThrow();
  });
});

describe("analyze (servidor)", () => {
  it("valida entrada e avisa quando não há chave", async () => {
    await expect(analyze({ job: "curta", resume: "x" }, {})).rejects.toBeInstanceOf(HttpError);
    await expect(analyze(demoInput, {})).rejects.toMatchObject({ status: 503 });
  });
});
