import type {
  AnalysisResult,
  CompanyBridge,
  Gap,
  Importance,
  InterviewQuestion,
  Keyword,
  ResumeSection,
  Suggestion,
} from "./types.js";

// A resposta da IA é tratada como dado não confiável: tudo é conferido e
// convertido para o formato esperado, descartando o que vier quebrado.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown, max = 300): string[] => arr(v).map((s) => str(s, max)).filter(Boolean);

export class InvalidAnalysisError extends Error {}

function parseSections(v: unknown): ResumeSection[] {
  return arr(v)
    .filter(isObj)
    .map((s, i) => ({
      id: str(s.id, 40) || `s${i + 1}`,
      title: str(s.title, 120),
      lines: arr(s.lines)
        .filter(isObj)
        .map((l, j) => ({ id: str(l.id, 40) || `s${i + 1}l${j + 1}`, text: str(l.text) }))
        .filter((l) => l.text),
    }))
    .filter((s) => s.title || s.lines.length);
}

function parseSuggestions(v: unknown, sections: ResumeSection[]): Suggestion[] {
  const lineIds = new Set(sections.flatMap((s) => s.lines.map((l) => l.id)));
  return arr(v)
    .filter(isObj)
    .map((s, i) => {
      const rawLine = s.lineId;
      const lineId = typeof rawLine === "string" && rawLine.trim() ? rawLine.trim() : null;
      return {
        id: str(s.id, 40) || `m${i + 1}`,
        sectionId: str(s.sectionId, 40),
        lineId,
        original: str(s.original),
        suggested: str(s.suggested),
        reason: str(s.reason, 600),
        evidence: str(s.evidence, 800),
        requirement: str(s.requirement, 300),
      };
    })
    .filter((s) => s.suggested && s.suggested !== s.original)
    // Uma mudança que aponta para uma linha que não existe vira "linha nova".
    .map((s) => (s.lineId && s.lineId !== "headline" && !lineIds.has(s.lineId) ? { ...s, lineId: null } : s));
}

function parseKeywords(v: unknown): Keyword[] {
  const seen = new Set<string>();
  return arr(v)
    .filter(isObj)
    .map((k) => {
      const importance: Importance = str(k.importance).toLowerCase().startsWith("ess") ? "essencial" : "desejavel";
      return { term: str(k.term, 80), importance, synonyms: strList(k.synonyms, 80).slice(0, 6) };
    })
    .filter((k) => {
      const key = k.term.toLowerCase();
      if (!k.term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseGaps(v: unknown): Gap[] {
  return arr(v)
    .filter(isObj)
    .map((g) => ({
      requirement: str(g.requirement, 200),
      why: str(g.why, 600),
      action: str(g.action, 800),
      timeframe: str(g.timeframe, 80),
    }))
    .filter((g) => g.requirement && g.action);
}

function parseBridge(v: unknown): CompanyBridge | null {
  if (!isObj(v)) return null;
  const sentence = str(v.sentence, 800);
  return sentence ? { sentence, valuesMatched: strList(v.valuesMatched, 120) } : null;
}

function parseQuestions(v: unknown): InterviewQuestion[] {
  return arr(v)
    .filter(isObj)
    .map((q) => ({ question: str(q.question, 400), tip: str(q.tip, 600) }))
    .filter((q) => q.question);
}

export function parseAnalysis(raw: unknown): AnalysisResult {
  if (!isObj(raw)) throw new InvalidAnalysisError("Resposta da IA não é um objeto.");
  const sections = parseSections(raw.sections);
  if (!sections.length) throw new InvalidAnalysisError("A IA não conseguiu ler as seções do currículo.");
  const candidate = isObj(raw.candidate) ? raw.candidate : {};
  return {
    jobTitle: str(raw.jobTitle, 160),
    companyName: str(raw.companyName, 160),
    candidate: {
      name: str(candidate.name, 120),
      headline: str(candidate.headline, 200),
      contact: strList(candidate.contact, 160).slice(0, 6),
    },
    sections,
    suggestions: parseSuggestions(raw.suggestions, sections).slice(0, 20),
    keywords: parseKeywords(raw.keywords).slice(0, 30),
    gaps: parseGaps(raw.gaps).slice(0, 8),
    companyBridge: parseBridge(raw.companyBridge),
    recruiterMessage: str(raw.recruiterMessage, 2000),
    interviewQuestions: parseQuestions(raw.interviewQuestions).slice(0, 6),
  };
}

/** Extrai o JSON mesmo quando o modelo embrulha a resposta em ```json ... ```. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new InvalidAnalysisError("A IA não devolveu JSON.");
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      throw new InvalidAnalysisError("A IA devolveu um JSON inválido.");
    }
  }
}
