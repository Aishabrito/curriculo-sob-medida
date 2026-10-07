import { readPdfLayout, type PdfLayout } from "./layout";

// Lê o texto do currículo direto no navegador — o arquivo nunca é enviado inteiro,
// só o texto extraído. Também guarda o necessário para manter a formatação:
// o estilo visual (PDF) ou o próprio arquivo (Word).

export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md";

export type SourceFile =
  | { kind: "pdf"; name: string; layout: PdfLayout }
  | { kind: "docx"; name: string; base64: string }
  | { kind: "text"; name: string };

export interface Extracted {
  text: string;
  source: SourceFile;
}

async function fromPdf(file: File): Promise<Extracted> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), fontExtraProperties: true }).promise;
  const layout = await readPdfLayout(doc);
  const text = layout.lines
    .map((l, i) => {
      const prev = layout.lines[i - 1];
      const gap = prev && prev.page === l.page && l.y - prev.y > l.size * 2 ? "\n" : "";
      return gap + l.text;
    })
    .join("\n");
  return { text, source: { kind: "pdf", name: file.name, layout } };
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function fromDocx(file: File): Promise<Extracted> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { text: value, source: { kind: "docx", name: file.name, base64: toBase64(buffer) } };
}

export function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(file: File): Promise<Extracted> {
  const name = file.name.toLowerCase();
  if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo muito grande (máximo 8 MB).");
  let out: Extracted;
  if (name.endsWith(".pdf")) out = await fromPdf(file);
  else if (name.endsWith(".docx")) out = await fromDocx(file);
  else if (name.endsWith(".txt") || name.endsWith(".md")) out = { text: await file.text(), source: { kind: "text", name: file.name } };
  else throw new Error("Formato não suportado. Use PDF, DOCX ou TXT.");
  out.text = cleanText(out.text);
  if (out.text.length < 200) {
    throw new Error("Não consegui ler texto suficiente. Se o PDF for uma imagem (escaneado), cole o texto do currículo.");
  }
  return out;
}
