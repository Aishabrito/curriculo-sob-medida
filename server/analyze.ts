import { extractJson, parseAnalysis } from "../shared/parseAnalysis.js";
import type { AnalyzeInput, AnalyzeResponse } from "../shared/types.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  RATE_LIMIT_PER_HOUR?: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const LIMITS = { job: [80, 12000], company: [0, 6000], resume: [200, 15000] } as const;

export function validateInput(body: unknown): AnalyzeInput {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "Envie a vaga e o currículo.");
  const b = body as Record<string, unknown>;
  const job = typeof b.job === "string" ? b.job.trim() : "";
  const company = typeof b.company === "string" ? b.company.trim() : "";
  const resume = typeof b.resume === "string" ? b.resume.trim() : "";
  if (job.length < LIMITS.job[0]) throw new HttpError(400, "Conte um pouco mais sobre a vaga (cole a descrição completa).");
  if (resume.length < LIMITS.resume[0]) throw new HttpError(400, "Não consegui ler texto suficiente do currículo.");
  if (job.length > LIMITS.job[1]) throw new HttpError(413, "A descrição da vaga está grande demais.");
  if (company.length > LIMITS.company[1]) throw new HttpError(413, "O texto sobre a empresa está grande demais.");
  if (resume.length > LIMITS.resume[1]) throw new HttpError(413, "O currículo está grande demais.");
  return { job, company, resume };
}

// Limite simples por IP, em memória. Em funções serverless a memória pode
// ser reiniciada a qualquer momento, então é só uma proteção básica contra
// alguém gastar a cota grátis inteira sozinho.
const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string, perHour: number, now = Date.now()): void {
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= perHour) {
    throw new HttpError(429, "Você chegou ao limite de análises por hora. Tente de novo mais tarde — ou veja o exemplo pronto.");
  }
  recent.push(now);
  hits.set(ip, recent);
}

async function callGemini(input: AnalyzeInput, key: string, model: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini não devolveu texto.");
  return text;
}

async function callGroq(input: AnalyzeInput, key: string, model: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq não devolveu texto.");
  return text;
}

/** Tenta o Gemini primeiro; se falhar (cota, fora do ar, JSON ruim), tenta o Groq. */
export async function analyze(body: unknown, env: ServerEnv, ip = "anon"): Promise<AnalyzeResponse> {
  const input = validateInput(body);

  const providers: { name: AnalyzeResponse["provider"]; run: () => Promise<string> }[] = [];
  if (env.GEMINI_API_KEY) {
    providers.push({ name: "gemini", run: () => callGemini(input, env.GEMINI_API_KEY!, env.GEMINI_MODEL || "gemini-2.5-flash") });
  }
  if (env.GROQ_API_KEY) {
    providers.push({ name: "groq", run: () => callGroq(input, env.GROQ_API_KEY!, env.GROQ_MODEL || "llama-3.3-70b-versatile") });
  }
  if (!providers.length) {
    throw new HttpError(503, "O site ainda não tem uma chave de IA configurada. Enquanto isso, veja o exemplo pronto.");
  }

  checkRateLimit(ip, Number(env.RATE_LIMIT_PER_HOUR) || 8);

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const result = parseAnalysis(extractJson(await p.run()));
      return { result, provider: p.name };
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.error("Falha em todos os provedores:", errors.join(" | "));
  throw new HttpError(502, "A IA está ocupada agora (provavelmente o limite grátis do dia). Tente de novo em alguns minutos.");
}
