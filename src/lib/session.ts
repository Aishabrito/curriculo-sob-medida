import type { AnalysisResult, AnalyzeInput, AnalyzeResponse, ApiError } from "../../shared/types";
import type { Decisions } from "./resume";

export interface Session {
  input: AnalyzeInput;
  result: AnalysisResult;
  decisions: Decisions;
  demo?: boolean;
}

// Fica só na aba do navegador (sessionStorage): fechou a aba, apagou.
const KEY = "csm:session";

export function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* navegação privada ou armazenamento cheio: segue só em memória */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function requestAnalysis(input: AnalyzeInput, signal?: AbortSignal): Promise<AnalysisResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const data = (await res.json().catch(() => ({ error: "Resposta inesperada do servidor." }))) as AnalyzeResponse | ApiError;
  if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `Erro ${res.status}`);
  return data.result;
}
