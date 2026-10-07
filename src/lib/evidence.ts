import { normalize, tokens } from "./text";

export type EvidenceStatus = "verificada" | "aproximada" | "sem-evidencia";

/**
 * Confere, no próprio navegador, se o trecho que a IA citou como prova
 * realmente existe no currículo original. É isso que impede o site de
 * aceitar uma frase inventada.
 */
export function checkEvidence(evidence: string, resumeText: string): EvidenceStatus {
  const ev = normalize(evidence);
  if (ev.length < 3) return "sem-evidencia";
  const cv = normalize(resumeText);
  if (cv.includes(ev)) return "verificada";

  const evTokens = tokens(evidence).filter((t) => t.length > 2);
  if (evTokens.length < 3) return "sem-evidencia";
  const cvTokens = new Set(tokens(resumeText));
  const found = evTokens.filter((t) => cvTokens.has(t)).length;
  return found / evTokens.length >= 0.85 ? "aproximada" : "sem-evidencia";
}
