import { describe, expect, it } from "vitest";
import { demoInput } from "../demo/example";
import { recruiterChecks } from "./recruiterChecks";

const level = (checks: ReturnType<typeof recruiterChecks>, id: string) => checks.find((c) => c.id === id)?.level;

describe("recruiterChecks", () => {
  it("currículo do exemplo passa no essencial", () => {
    const c = recruiterChecks({ text: demoInput.resume, job: demoInput.job });
    expect(level(c, "email")).toBe("ok");
    expect(level(c, "telefone")).toBe("ok");
    expect(level(c, "dados")).toBe("ok");
    expect(level(c, "datas")).toBe("ok");
    expect(level(c, "links")).toBe("atencao"); // tem GitHub mas não LinkedIn
    expect(level(c, "cliches")).toBe("atencao");
  });

  it("acha dados pessoais, e-mail informal, datas invertidas e excesso de páginas", () => {
    const text = `Maria Silva
gatinha123@hotmail.com | (21) 98888-7777
CPF: 123.456.789-00 | Estado civil: solteira | 22 anos
Rua das Flores, 120 - CEP 24000-000
Atendente - Loja X (2023 - 2021)
LinkedIn: linkedin.com/in/maria | github.com/maria`;
    const c = recruiterChecks({ text, job: "Estágio em desenvolvimento web", pages: 2, hasImages: true });
    expect(level(c, "email")).toBe("atencao");
    expect(c.find((x) => x.id === "dados")?.title).toMatch(/CPF.*endereço completo.*estado civil.*idade/);
    expect(level(c, "datas")).toBe("atencao");
    expect(level(c, "paginas")).toBe("atencao");
    expect(level(c, "foto")).toBe("atencao");
    expect(level(c, "links")).toBe("ok");
    expect(c[0].level).toBe("problema");
  });

  it("não cobra GitHub fora de vaga de tecnologia nem 1 página fora de vaga de entrada", () => {
    const c = recruiterChecks({ text: demoInput.resume, job: "Analista pleno de marketing com 5 anos de experiência", pages: 2 });
    expect(level(c, "links")).toBeUndefined();
    expect(level(c, "paginas")).toBe("ok");
  });
});
