import { parseAnalysis } from "../shared/parseAnalysis.js";
import type { AnalyzeInput, AnalyzeResponse } from "../shared/types.js";
import { checkRateLimit, ensureConfigured, HttpError, runAI, type ServerEnv } from "./ai.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";

export { checkRateLimit, HttpError, ProviderError, type ServerEnv } from "./ai.js";

const LIMITS = { job: [80, 12000], company: [0, 6000], resume: [200, 15000], extra: [0, 4000] } as const;

export function validateInput(body: unknown): AnalyzeInput {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "Envie a vaga e o currículo.");
  const b = body as Record<string, unknown>;
  const job = typeof b.job === "string" ? b.job.trim() : "";
  const company = typeof b.company === "string" ? b.company.trim() : "";
  const resume = typeof b.resume === "string" ? b.resume.trim() : "";
  const extra = typeof b.extra === "string" ? b.extra.trim() : "";
  if (job.length < LIMITS.job[0]) throw new HttpError(400, "Conte um pouco mais sobre a vaga (cole a descrição completa).");
  if (resume.length < LIMITS.resume[0]) throw new HttpError(400, "Não consegui ler texto suficiente do currículo.");
  if (job.length > LIMITS.job[1]) throw new HttpError(413, "A descrição da vaga está grande demais.");
  if (company.length > LIMITS.company[1]) throw new HttpError(413, "O texto sobre a empresa está grande demais.");
  if (resume.length > LIMITS.resume[1]) throw new HttpError(413, "O currículo está grande demais.");
  if (extra.length > LIMITS.extra[1]) throw new HttpError(413, "O texto do que você quer adicionar está grande demais.");
  return { job, company, resume, extra };
}

export async function analyze(body: unknown, env: ServerEnv, ip = "anon"): Promise<AnalyzeResponse> {
  const input = validateInput(body);
  ensureConfigured(env);
  checkRateLimit(`${ip}:analise`, Number(env.RATE_LIMIT_PER_HOUR) || 8);
  const { value, provider } = await runAI({ system: SYSTEM_PROMPT, user: buildUserPrompt(input) }, env, parseAnalysis);
  return { result: value, provider };
}
