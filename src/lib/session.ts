import type { AnalysisResult, AnalyzeInput, AnalyzeResponse, ApiError } from "../../shared/types";
import type { SourceFile } from "./extractText";
import type { Decisions } from "./resume";

export interface Session {
  input: AnalyzeInput;
  result: AnalysisResult;
  decisions: Decisions;
  /** Arquivo original (estilo do PDF ou o próprio Word), para manter a formatação. */
  source?: SourceFile;
  demo?: boolean;
}

// Fica só na aba do navegador (sessionStorage): fechou a aba, apagou.
const KEY = "csm:session";
// Cópia em memória: vale mesmo quando o arquivo é grande demais para o sessionStorage.
let memory: Session | null = null;

export function saveSession(s: Session): void {
  memory = s;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    try {
      // Grande demais (ex.: Word com imagens): guarda sem o arquivo; a memória continua com ele.
      sessionStorage.setItem(KEY, JSON.stringify({ ...s, source: undefined }));
    } catch {
      /* navegação privada: segue só em memória */
    }
  }
}

export function loadSession(): Session | null {
  if (memory) return memory;
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
