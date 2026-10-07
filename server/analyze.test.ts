import { afterEach, describe, expect, it, vi } from "vitest";
import { demoInput, demoResult } from "../src/demo/example";
import { analyze } from "./analyze";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status: number, body: string) => new Response(body, { status });
const geminiText = (text: string, finishReason = "STOP") => ok({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

afterEach(() => vi.unstubAllGlobals());

let ipCounter = 0;
const run = (env: Record<string, string>) => analyze(demoInput, env, `ip-${ipCounter++}`);

describe("analyze com Gemini simulado", () => {
  it("pula modelo que não existe mais e usa o próximo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(404, "models/x is not found"))
      .mockResolvedValueOnce(geminiText(JSON.stringify(demoResult)));
    vi.stubGlobal("fetch", fetchMock);
    const res = await run({ GEMINI_API_KEY: "k" });
    expect(res.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("gemini-2.5-flash");
  });

  it("explica chave inválida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}')));
    await expect(run({ GEMINI_API_KEY: "k" })).rejects.toMatchObject({ status: 502, message: expect.stringContaining("chave do Gemini") });
  });

  it("explica resposta cortada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiText('{"sections": [', "MAX_TOKENS")));
    await expect(run({ GEMINI_API_KEY: "k" })).rejects.toMatchObject({ message: expect.stringContaining("longos demais") });
  });

  it("cai para o Groq quando o Gemini estoura o limite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("groq") ? ok({ choices: [{ message: { content: JSON.stringify(demoResult) } }] }) : fail(429, "quota"),
      ),
    );
    expect((await run({ GEMINI_API_KEY: "k", GROQ_API_KEY: "g" })).provider).toBe("groq");
  });
});
