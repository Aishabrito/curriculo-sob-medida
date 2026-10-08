import { InvalidAnalysisError } from "./parseAnalysis.js";
import type { Application, EnglishResume, EnglishSource, InterviewFeedback } from "./types.js";

// Validação das respostas da IA para os extras (dado não confiável, como na análise).

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 4000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, max = 400): string[] => (Array.isArray(v) ? v.map((s) => str(s, max)).filter(Boolean) : []);

export function parseApplication(raw: unknown): Application {
  if (!isObj(raw)) throw new InvalidAnalysisError("Resposta da IA não é um objeto.");
  const out = { subject: str(raw.subject, 200), email: str(raw.email, 2500), coverLetter: str(raw.coverLetter, 5000) };
  if (!out.email || !out.coverLetter) throw new InvalidAnalysisError("Faltou o e-mail ou a carta.");
  return out;
}

/**
 * A tradução precisa ter exatamente as mesmas seções e linhas do original,
 * na mesma ordem — é assim que ela é aplicada no Word ou no PDF. Linha que
 * faltar fica no original, em vez de sumir.
 */
export function parseEnglish(raw: unknown, source: EnglishSource): EnglishResume {
  if (!isObj(raw)) throw new InvalidAnalysisError("Resposta da IA não é um objeto.");
  const got = Array.isArray(raw.sections) ? raw.sections.filter(isObj) : [];
  if (!got.length) throw new InvalidAnalysisError("A tradução veio vazia.");
  const byId = new Map(got.map((s) => [str(s.id, 60), s]));
  let translated = 0;
  const sections = source.sections.map((src, i) => {
    const t = byId.get(src.id) ?? got[i];
    const lines = Array.isArray(t?.lines) ? t.lines : [];
    return {
      id: src.id,
      title: str(t?.title, 160) || src.title,
      lines: src.lines.map((orig, j) => {
        const line = str(lines[j], 1500);
        if (line) translated++;
        return line || orig;
      }),
    };
  });
  const total = source.sections.reduce((n, s) => n + s.lines.length, 0);
  if (total && translated < total * 0.6) throw new InvalidAnalysisError("A tradução veio incompleta.");
  return { headline: str(raw.headline, 300) || source.headline, sections };
}

export function parseFeedback(raw: unknown): InterviewFeedback {
  if (!isObj(raw)) throw new InvalidAnalysisError("Resposta da IA não é um objeto.");
  const score = Math.round(Number(raw.score));
  const out = {
    score: Number.isFinite(score) ? Math.min(5, Math.max(1, score)) : 3,
    strengths: strList(raw.strengths).slice(0, 4),
    improve: strList(raw.improve).slice(0, 4),
    betterAnswer: str(raw.betterAnswer, 2500),
  };
  if (!out.betterAnswer && !out.improve.length) throw new InvalidAnalysisError("O retorno veio vazio.");
  return out;
}
