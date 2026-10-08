import { afterEach, describe, expect, it, vi } from "vitest";
import { demoInput } from "../src/demo/example";
import { runExtra } from "./extras";

const gemini = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
let n = 0;
const base = { job: demoInput.job, company: demoInput.company, resume: demoInput.resume };
const env = { GEMINI_API_KEY: "k" };

afterEach(() => vi.unstubAllGlobals());

describe("runExtra", () => {
  it("gera e-mail e carta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gemini({ subject: "Candidatura", email: "Olá!", coverLetter: "Carta." }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await runExtra({ task: "candidatura", ...base }, env, `ip${n++}`)).toEqual({ subject: "Candidatura", email: "Olá!", coverLetter: "Carta." });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contents[0].parts[0].text).toContain("<curriculo>");
  });

  it("tradução mantém a estrutura e completa linhas que faltarem", async () => {
    const source = { headline: "Estudante", sections: [{ id: "s1", title: "Projetos", lines: ["A", "B", "C"] }, { id: "s2", title: "Habilidades", lines: ["D"] }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gemini({ headline: "Student", sections: [{ id: "s1", title: "Projects", lines: ["A-en", "B-en"] }, { id: "s2", title: "Skills", lines: ["D-en"] }] })));
    const en = await runExtra({ task: "ingles", ...base, source }, env, `ip${n++}`);
    expect(en).toEqual({ headline: "Student", sections: [{ id: "s1", title: "Projects", lines: ["A-en", "B-en", "C"] }, { id: "s2", title: "Skills", lines: ["D-en"] }] });
  });

  it("recusa tradução quase vazia", async () => {
    const source = { headline: "", sections: [{ id: "s1", title: "P", lines: ["A", "B", "C", "D", "E"] }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gemini({ sections: [{ id: "s1", title: "P", lines: ["A-en"] }] })));
    await expect(runExtra({ task: "ingles", ...base, source }, env, `ip${n++}`)).rejects.toMatchObject({ status: 502 });
  });

  it("dá retorno de entrevista e limita a nota de 1 a 5", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gemini({ score: 9, strengths: ["Exemplo concreto"], improve: [], betterAnswer: "Eu criei…" })));
    const fb = await runExtra({ task: "entrevista", ...base, question: "Fale de um projeto.", answer: "Eu fiz o Feira Livre Online em React." }, env, `ip${n++}`);
    expect(fb).toMatchObject({ score: 5, strengths: ["Exemplo concreto"], betterAnswer: "Eu criei…" });
  });

  it("valida a entrada antes de chamar a IA", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(runExtra({ task: "entrevista", ...base, question: "Oi?", answer: "curta" }, env, `ip${n++}`)).rejects.toMatchObject({ status: 400 });
    await expect(runExtra({ task: "outra", ...base }, env, `ip${n++}`)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
