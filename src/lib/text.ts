/** Minúsculas, sem acento, sem pontuação e com espaços únicos — para comparar textos. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/** Procura `term` como palavra(s) inteira(s) dentro de `text` (ambos já normalizados). */
export function containsPhrase(normText: string, normTerm: string): boolean {
  if (!normTerm) return false;
  return ` ${normText} `.includes(` ${normTerm} `);
}

const DATE_END = /(\d{2,4}|atual|presente)\.?$/i;
const DATE_START = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s*\/?\s*\d{2,4}|^\d{1,2}\/\d{2,4}|^\d{4}|^(atual|presente|hoje|o momento)/i;

/**
 * Tira o travessão, que é a marca mais óbvia de texto feito por IA.
 * "mar 2024 — jul 2025" vira "mar 2024 a jul 2025"; "Cargo — Empresa" vira
 * "Cargo, Empresa" (ou "Cargo | Empresa" na linha de título de um item).
 */
export function humanize(text: string, header = false): string {
  return text
    .replace(/^\s*[—–]\s*/, "")
    .replace(/\s*[—–]\s*/g, (dash, offset: number, all: string) => {
      const before = all.slice(0, offset).trimEnd();
      const after = all.slice(offset + dash.length);
      if (DATE_END.test(before) && DATE_START.test(after)) return " a ";
      if (!/\s/.test(dash) && /\w$/.test(before) && /^\w/.test(after)) return "-";
      return header ? " | " : ", ";
    })
    .replace(/,\s*,/g, ",")
    .trim();
}
