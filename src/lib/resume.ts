import type { AnalysisResult, ResumeSection, Suggestion } from "../../shared/types";

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
  sections: { title: string; lines: string[] }[];
}

const textOf = (s: Suggestion, st?: SuggestionState) => (st?.edited ?? s.suggested).trim();

/** Monta o currículo final aplicando só as mudanças aceitas. */
export function buildFinalResume(result: AnalysisResult, decisions: Decisions): FinalResume {
  const accepted = result.suggestions.filter((s) => decisions[s.id]?.decision === "aceita");
  const replacements = new Map<string, string>();
  const additions = new Map<string, string[]>();
  let headline = result.candidate.headline;

  for (const s of accepted) {
    const text = textOf(s, decisions[s.id]);
    if (!text) continue;
    if (s.lineId === "headline") headline = text;
    else if (s.lineId) replacements.set(s.lineId, text);
    else additions.set(s.sectionId, [...(additions.get(s.sectionId) ?? []), text]);
  }

  const known = new Set(result.sections.map((s) => s.id));
  const sections = result.sections.map((sec: ResumeSection) => ({
    title: sec.title,
    lines: [...sec.lines.map((l) => replacements.get(l.id) ?? l.text), ...(additions.get(sec.id) ?? [])],
  }));

  // Linhas novas para uma seção que não existia (ex.: resumo profissional) entram no topo.
  const newSections = [...additions.entries()]
    .filter(([id]) => !known.has(id))
    .map(([id, lines]) => ({ title: /resumo|summary|perfil/i.test(id) ? "Resumo profissional" : id, lines }));

  return {
    name: result.candidate.name,
    headline,
    contact: result.candidate.contact,
    sections: [...newSections, ...sections].filter((s) => s.lines.length),
  };
}

export function resumeToText(r: FinalResume): string {
  return [r.name, r.headline, r.contact.join(" | "), ...r.sections.flatMap((s) => [s.title, ...s.lines])]
    .filter(Boolean)
    .join("\n");
}
