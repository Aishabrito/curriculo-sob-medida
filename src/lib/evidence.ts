import { normalize, tokens } from "./text";

export type EvidenceStatus = "verificada" | "aproximada" | "do-relato" | "sem-evidencia";

function matchIn(evidence: string, source: string): "exata" | "aproximada" | null {
  const ev = normalize(evidence);
  if (ev.length < 3 || !source.trim()) return null;
  if (normalize(source).includes(ev)) return "exata";
  const evTokens = tokens(evidence).filter((t) => t.length > 2);
  if (evTokens.length < 3) return null;
  const srcTokens = new Set(tokens(source));
  const found = evTokens.filter((t) => srcTokens.has(t)).length;
  return found / evTokens.length >= 0.85 ? "aproximada" : null;
}

/**
 * Confere, no próprio navegador, se o trecho que a IA citou como prova
 * realmente existe no currículo original — ou no que a pessoa contou no
 * campo "o que não está no currículo". É isso que impede o site de aceitar
 * uma frase inventada.
 */
export function checkEvidence(evidence: string, resumeText: string, extraText = ""): EvidenceStatus {
  const inResume = matchIn(evidence, resumeText);
  if (inResume === "exata") return "verificada";
  if (matchIn(evidence, extraText)) return "do-relato";
  return inResume === "aproximada" ? "aproximada" : "sem-evidencia";
}
