import { extractJson, InvalidAnalysisError, parseAnalysis } from "../shared/parseAnalysis.js";
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

/** Erro de um provedor de IA com uma mensagem que pode ser mostrada na tela. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public retryNextModel = false,
  ) {
    super(message);
  }
}

function describeFailure(provider: string, status: number, body: string): ProviderError {
  const detail = `${provider} respondeu ${status}: ${body.slice(0, 400)}`;
  const name = provider === "gemini" ? "Gemini" : "Groq";
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) {
    return new ProviderError(detail, `A chave do ${name} configurada na Vercel é inválida. Confira a variável ${provider.toUpperCase()}_API_KEY e faça um novo deploy.`);
  }
  if (status === 401 || status === 403) {
    return new ProviderError(detail, `A chave do ${name} não tem permissão. Gere uma nova chave e atualize a variável ${provider.toUpperCase()}_API_KEY na Vercel.`);
  }
  if (status === 404) return new ProviderError(detail, `O modelo de IA do ${name} não foi encontrado.`, true);
  // Cada modelo tem sua própria cota e sua própria fila, então limite ou
  // sobrecarga em um deles é motivo para tentar o próximo.
  if (status === 429) return new ProviderError(detail, `O limite grátis do ${name} acabou por agora. Tente de novo em alguns minutos.`, true);
  if (status >= 500) return new ProviderError(detail, `O ${name} está sobrecarregado agora (erro ${status}). Tente de novo em alguns minutos.`, true);
  return new ProviderError(detail, `O ${name} recusou o pedido (erro ${status}).`);
}

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.0-flash"];

async function callGeminiModel(input: AnalyzeInput, key: string, model: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      // O "pensamento" do modelo conta no limite de saída, então o limite é alto
      // para o JSON não ser cortado no meio.
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 32768 },
    }),
  });
  if (!res.ok) throw describeFailure("gemini", res.status, await res.text());
  const data = (await res.json()) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
  if (data.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") {
    throw new ProviderError(`Gemini bloqueou: ${data.promptFeedback?.blockReason ?? "SAFETY"}`, "O Gemini bloqueou o texto enviado. Tente tirar dados pessoais do currículo.");
  }
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new ProviderError("Gemini cortou a resposta (MAX_TOKENS).", "O currículo ou a vaga são longos demais para uma análise. Tente encurtar a descrição da vaga.");
  }
  if (!text) throw new ProviderError(`Gemini não devolveu texto (${candidate?.finishReason ?? "sem motivo"}).`, "O Gemini não devolveu resposta. Tente de novo.");
  return text;
}

/** Tenta o modelo configurado e, se ele não existir mais, os próximos da lista. */
async function callGemini(input: AnalyzeInput, key: string, preferred?: string): Promise<string> {
  const models = [...new Set([preferred, ...GEMINI_MODELS].filter((m): m is string => Boolean(m)))];
  let last: unknown;
  for (const model of models) {
    try {
      return await callGeminiModel(input, key, model);
    } catch (err) {
      last = err;
      if (!(err instanceof ProviderError && err.retryNextModel)) throw err;
    }
  }
  throw last;
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
  if (!res.ok) throw describeFailure("groq", res.status, await res.text());
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new ProviderError("Groq não devolveu texto.", "O Groq não devolveu resposta. Tente de novo.");
  return text;
}

/** Tenta o Gemini primeiro; se falhar (cota, fora do ar, JSON ruim), tenta o Groq. */
export async function analyze(body: unknown, env: ServerEnv, ip = "anon"): Promise<AnalyzeResponse> {
  const input = validateInput(body);

  const providers: { name: AnalyzeResponse["provider"]; run: () => Promise<string> }[] = [];
  if (env.GEMINI_API_KEY) {
    providers.push({ name: "gemini", run: () => callGemini(input, env.GEMINI_API_KEY!, env.GEMINI_MODEL) });
  }
  if (env.GROQ_API_KEY) {
    providers.push({ name: "groq", run: () => callGroq(input, env.GROQ_API_KEY!, env.GROQ_MODEL || "llama-3.3-70b-versatile") });
  }
  if (!providers.length) {
    throw new HttpError(503, "O site ainda não tem uma chave de IA configurada. Enquanto isso, veja o exemplo pronto.");
  }

  checkRateLimit(ip, Number(env.RATE_LIMIT_PER_HOUR) || 8);

  const errors: string[] = [];
  const userMessages: string[] = [];
  for (const p of providers) {
    try {
      const result = parseAnalysis(extractJson(await p.run()));
      return { result, provider: p.name };
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
      userMessages.push(
        err instanceof ProviderError
          ? err.userMessage
          : err instanceof InvalidAnalysisError
            ? `A IA devolveu uma resposta incompleta (${err.message}) Tente de novo.`
            : "Não consegui falar com a IA. Tente de novo em alguns minutos.",
      );
    }
  }
  console.error("Falha em todos os provedores:", errors.join(" | "));
  throw new HttpError(502, userMessages.join(" "));
}
