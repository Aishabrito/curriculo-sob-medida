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
