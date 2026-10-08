import type { AnalysisResult, EnglishResume, EnglishSource, ResumeSection, Suggestion } from "../../shared/types";

export type Decision = "pendente" | "aceita" | "recusada";

export interface SuggestionState {
  decision: Decision;
  /** Texto editado pela pessoa (se ela ajustou a sugestão). */
  edited?: string;
}

export type Decisions = Record<string, SuggestionState>;

export interface FinalResume {
  name: string;
  headline: string;
  contact: string[];
  /** lineIds[i] é o id da linha original (null para linha nova). */
  sections: { id: string; title: string; lines: string[]; lineIds: (string | null)[] }[];
}

const textOf = (s: Suggestion, st?: SuggestionState) => (st?.edited ?? s.suggested).trim();

export interface Edits {
  /** lineId → texto novo */
  replacements: Map<string, string>;
  /** sectionId → linhas novas */
  additions: Map<string, string[]>;
  headline: string | null;
}

/** Junta as mudanças aceitas (já com as edições da pessoa). */
export function collectEdits(result: AnalysisResult, decisions: Decisions): Edits {
  const edits: Edits = { replacements: new Map(), additions: new Map(), headline: null };
  for (const s of result.suggestions) {
    if (decisions[s.id]?.decision !== "aceita") continue;
    const text = textOf(s, decisions[s.id]);
    if (!text) continue;
    if (s.lineId === "headline") edits.headline = text;
    else if (s.lineId) edits.replacements.set(s.lineId, text);
    else edits.additions.set(s.sectionId, [...(edits.additions.get(s.sectionId) ?? []), text]);
  }
  return edits;
}

export const isSummarySection = (id: string) => /resumo|summary|perfil|objetivo/i.test(id);
export const titleForNewSection = (id: string) =>
  isSummarySection(id) ? "Resumo profissional" : id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, " ");

/** Monta o currículo final aplicando só as mudanças aceitas. */
export function buildFinalResume(result: AnalysisResult, decisions: Decisions): FinalResume {
  const { replacements, additions, headline: newHeadline } = collectEdits(result, decisions);
  const headline = newHeadline ?? result.candidate.headline;

  const known = new Set(result.sections.map((s) => s.id));
  const sections = result.sections.map((sec: ResumeSection) => ({
    id: sec.id,
    title: sec.title,
    lines: [...sec.lines.map((l) => replacements.get(l.id) ?? l.text), ...(additions.get(sec.id) ?? [])],
    lineIds: [...sec.lines.map((l) => l.id), ...(additions.get(sec.id) ?? []).map(() => null)],
  }));

  // Linhas novas para uma seção que não existia: o resumo profissional entra
  // no topo; qualquer outra (ex.: "cursos") entra no fim.
  const isSummary = isSummarySection;
  const titleFor = titleForNewSection;
  const created = [...additions.entries()]
    .filter(([id]) => !known.has(id))
    .map(([id, lines]) => ({ id, title: titleFor(id), lines, lineIds: lines.map(() => null) }));

  return {
    name: result.candidate.name,
    headline,
    contact: result.candidate.contact,
    sections: [
      ...created.filter((c) => isSummary(c.id)),
      ...sections,
      ...created.filter((c) => !isSummary(c.id)),
    ]
      .filter((s) => s.lines.length),
  };
}

export function toEnglishSource(r: FinalResume): EnglishSource {
  return { headline: r.headline, sections: r.sections.map(({ id, title, lines }) => ({ id, title, lines })) };
}

/** Mesmo currículo, com os textos trocados pela tradução (seção por seção, linha por linha). */
export function applyEnglish(r: FinalResume, en: EnglishResume): FinalResume {
  return {
    ...r,
    headline: en.headline || r.headline,
    sections: r.sections.map((s, i) => {
      const t = en.sections.find((x) => x.id === s.id) ?? en.sections[i];
      return { ...s, title: t?.title || s.title, lines: s.lines.map((l, j) => t?.lines[j] || l) };
    }),
  };
}

/** Pares português → inglês para trocar no Word. */
export function englishPairs(r: FinalResume, en: FinalResume): { from: string; to: string }[] {
  const pairs = [{ from: r.headline, to: en.headline }];
  r.sections.forEach((s, i) => {
    pairs.push({ from: s.title, to: en.sections[i].title });
    s.lines.forEach((l, j) => pairs.push({ from: l, to: en.sections[i].lines[j] }));
  });
  return pairs;
}

export function resumeToText(r: FinalResume): string {
  return [r.name, r.headline, r.contact.join(" | "), ...r.sections.flatMap((s) => [s.title, ...s.lines])]
    .filter(Boolean)
    .join("\n");
}
