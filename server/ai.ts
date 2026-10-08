import { extractJson, InvalidAnalysisError } from "../shared/parseAnalysis.js";

// Conversa com a IA: Gemini (grátis) primeiro, Groq (grátis) de reserva.
// Serve para qualquer tarefa: recebe o prompt e uma função que valida o JSON.

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  RATE_LIMIT_PER_HOUR?: string;
  RATE_LIMIT_EXTRAS_PER_HOUR?: string;
}

export interface Prompt {
  system: string;
  user: string;
  temperature?: number;
}

export type Provider = "gemini" | "groq";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Limite simples por IP, em memória. Em funções serverless a memória pode
// ser reiniciada a qualquer momento, então é só uma proteção básica contra
// alguém gastar a cota grátis inteira sozinho.
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, perHour: number, now = Date.now()): void {
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (hits.get(key) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= perHour) {
    throw new HttpError(429, "Você chegou ao limite de usos por hora. Tente de novo mais tarde — ou veja o exemplo pronto.");
  }
  recent.push(now);
  hits.set(key, recent);
}

export function ensureConfigured(env: ServerEnv): void {
  if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY) {
    throw new HttpError(503, "O site ainda não tem uma chave de IA configurada. Enquanto isso, veja o exemplo pronto.");
  }
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

async function callGeminiModel(prompt: Prompt, key: string, model: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      // O "pensamento" do modelo conta no limite de saída, então o limite é alto
      // para o JSON não ser cortado no meio.
      generationConfig: { responseMimeType: "application/json", temperature: prompt.temperature ?? 0.4, maxOutputTokens: 32768 },
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
async function callGemini(prompt: Prompt, key: string, preferred?: string): Promise<string> {
  const models = [...new Set([preferred, ...GEMINI_MODELS].filter((m): m is string => Boolean(m)))];
  let last: unknown;
  for (const model of models) {
    try {
      return await callGeminiModel(prompt, key, model);
    } catch (err) {
      last = err;
      if (!(err instanceof ProviderError && err.retryNextModel)) throw err;
    }
  }
  throw last;
}

async function callGroq(prompt: Prompt, key: string, model: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: prompt.temperature ?? 0.4,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw describeFailure("groq", res.status, await res.text());
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new ProviderError("Groq não devolveu texto.", "O Groq não devolveu resposta. Tente de novo.");
  return text;
}

/** Roda o prompt no Gemini e, se falhar (cota, fora do ar, JSON ruim), no Groq. */
export async function runAI<T>(prompt: Prompt, env: ServerEnv, parse: (raw: unknown) => T): Promise<{ value: T; provider: Provider }> {
  const providers: { name: Provider; run: () => Promise<string> }[] = [];
  if (env.GEMINI_API_KEY) providers.push({ name: "gemini", run: () => callGemini(prompt, env.GEMINI_API_KEY!, env.GEMINI_MODEL) });
  if (env.GROQ_API_KEY) providers.push({ name: "groq", run: () => callGroq(prompt, env.GROQ_API_KEY!, env.GROQ_MODEL || "llama-3.3-70b-versatile") });
  ensureConfigured(env);

  const errors: string[] = [];
  const userMessages: string[] = [];
  for (const p of providers) {
    try {
      return { value: parse(extractJson(await p.run())), provider: p.name };
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
