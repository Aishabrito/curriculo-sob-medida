import { normalize } from "./text";

interface Cliche {
  /** Formas normalizadas (sem acento, minúsculas) a procurar. */
  patterns: string[];
  label: string;
  tip: string;
}

const CLICHES: Cliche[] = [
  { label: "proativo(a)", patterns: ["proativo", "proativa", "proatividade"], tip: "Conte uma vez em que você resolveu algo sem ninguém pedir." },
  { label: "sinergia", patterns: ["sinergia"], tip: "Diga com quem trabalhou e o que entregaram juntos." },
  { label: "apaixonado(a) por", patterns: ["apaixonado por", "apaixonada por", "paixao por"], tip: "Mostre o que você já construiu com esse interesse." },
  { label: "busco desafios", patterns: ["busco desafios", "busco novos desafios", "amo desafios", "gosto de desafios"], tip: "Cite um desafio real que você enfrentou." },
  { label: "dinâmico(a)", patterns: ["dinamico", "dinamica"], tip: "Troque por um exemplo de ritmo ou volume de trabalho." },
  { label: "resiliente", patterns: ["resiliente", "resiliencia"], tip: "Descreva um problema difícil e como você saiu dele." },
  { label: "fora da caixa", patterns: ["fora da caixa"], tip: "Mostre a solução diferente que você criou." },
  { label: "agregar valor", patterns: ["agregar valor", "agregando valor"], tip: "Diga qual foi o resultado concreto." },
  { label: "orientado(a) a resultados", patterns: ["orientado a resultados", "orientada a resultados", "focado em resultados", "focada em resultados"], tip: "Mostre um resultado, não o adjetivo." },
  { label: "multitarefa", patterns: ["multitarefa", "multitarefas"], tip: "Liste as frentes que você tocava ao mesmo tempo." },
  { label: "alavancar", patterns: ["alavancar", "alavancando"], tip: "Use um verbo direto: aumentei, reduzi, criei." },
  { label: "expertise", patterns: ["expertise", "know how"], tip: "Diga quanto tempo e em que projetos você usou." },
  { label: "vestir a camisa", patterns: ["vestir a camisa", "visto a camisa"], tip: "Mostre comprometimento com um fato." },
  { label: "sede de aprendizado", patterns: ["sede de aprendizado", "sede de conhecimento", "vontade de aprender"], tip: "Cite o que você aprendeu sozinha recentemente." },
  { label: "perfil inovador", patterns: ["perfil inovador", "inovadora", "inovador"], tip: "Mostre o que você fez de novo." },
  { label: "excelente comunicação", patterns: ["excelente comunicacao", "otima comunicacao", "boa comunicacao"], tip: "Cite onde você apresentou, ensinou ou documentou algo." },
  { label: "comprometido(a)", patterns: ["comprometido", "comprometida"], tip: "Troque por uma entrega que você cumpriu." },
  { label: "perfeccionista", patterns: ["perfeccionista"], tip: "Fale do seu cuidado com qualidade com um exemplo." },
];

export interface ClicheHit {
  label: string;
  tip: string;
  count: number;
}

export function findCliches(text: string): ClicheHit[] {
  const norm = ` ${normalize(text)} `;
  return CLICHES.map((c) => {
    const count = c.patterns.reduce((sum, p) => sum + (norm.split(` ${p} `).length - 1), 0);
    return { label: c.label, tip: c.tip, count };
  }).filter((h) => h.count > 0);
}

/**
 * Nota de 0 a 100 para "soa humano": desconta clichês e frases longas
 * demais, que são a cara de texto gerado por IA.
 */
export function humanScore(text: string): number {
  const cliches = findCliches(text).reduce((s, h) => s + h.count, 0);
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const longOnes = sentences.filter((s) => s.split(/\s+/).length > 35).length;
  return Math.max(0, Math.min(100, 100 - cliches * 8 - longOnes * 4));
}

/** Divide o texto em pedaços marcando onde há clichê, para destacar na tela. */
export function highlightCliches(text: string): { text: string; cliche: boolean }[] {
  const patterns = CLICHES.flatMap((c) => c.patterns).sort((a, b) => b.length - a.length);
  const parts: { text: string; cliche: boolean }[] = [];
  const words = text.split(/(\s+)/);
  let i = 0;
  while (i < words.length) {
    let matched = 0;
    for (const p of patterns) {
      const n = p.split(" ").length * 2 - 1;
      const chunk = words.slice(i, i + n).join("");
      if (normalize(chunk) === p) {
        matched = n;
        break;
      }
    }
    if (matched) {
      parts.push({ text: words.slice(i, i + matched).join(""), cliche: true });
      i += matched;
    } else {
      const last = parts[parts.length - 1];
      if (last && !last.cliche) last.text += words[i];
      else parts.push({ text: words[i], cliche: false });
      i += 1;
    }
  }
  return parts;
}
