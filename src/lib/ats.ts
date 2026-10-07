import type { Keyword } from "../../shared/types";
import { containsPhrase, normalize } from "./text";

export type KeywordStatus = "tinha" | "adicionada" | "faltando";

export interface KeywordReport {
  keyword: Keyword;
  status: KeywordStatus;
}

export interface AtsReport {
  before: number;
  after: number;
  keywords: KeywordReport[];
}

const weight = (k: Keyword) => (k.importance === "essencial" ? 2 : 1);

export function hasKeyword(normText: string, k: Keyword): boolean {
  return [k.term, ...k.synonyms].some((t) => containsPhrase(normText, normalize(t)));
}

function coverage(normText: string, keywords: Keyword[]): number {
  const total = keywords.reduce((s, k) => s + weight(k), 0);
  if (!total) return 0;
  const hit = keywords.filter((k) => hasKeyword(normText, k)).reduce((s, k) => s + weight(k), 0);
  return Math.round((hit / total) * 100);
}

/**
 * Simula a leitura de um filtro ATS: conta quais termos da vaga aparecem
 * no texto, com peso maior para os essenciais. A conta é feita aqui, de
 * forma determinística — não é um "chute" da IA.
 */
export function atsReport(originalText: string, finalText: string, keywords: Keyword[]): AtsReport {
  const before = normalize(originalText);
  const after = normalize(finalText);
  const order: Record<KeywordStatus, number> = { adicionada: 0, tinha: 1, faltando: 2 };
  return {
    before: coverage(before, keywords),
    after: coverage(after, keywords),
    keywords: keywords
      .map((keyword): KeywordReport => {
        const had = hasKeyword(before, keyword);
        const has = hasKeyword(after, keyword);
        return { keyword, status: had ? "tinha" : has ? "adicionada" : "faltando" };
      })
      .sort((a, b) => order[a.status] - order[b.status] || weight(b.keyword) - weight(a.keyword)),
  };
}
