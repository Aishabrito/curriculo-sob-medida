// Lê o texto do currículo direto no navegador — o arquivo nunca é enviado inteiro,
// só o texto extraído.

export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md";

async function fromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let page = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      page += item.str;
      page += item.hasEOL ? "\n" : item.str.endsWith(" ") ? "" : " ";
    }
    pages.push(page);
  }
  return pages.join("\n");
}

async function fromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

export function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo muito grande (máximo 8 MB).");
  let text: string;
  if (name.endsWith(".pdf")) text = await fromPdf(file);
  else if (name.endsWith(".docx")) text = await fromDocx(file);
  else if (name.endsWith(".txt") || name.endsWith(".md")) text = await file.text();
  else throw new Error("Formato não suportado. Use PDF, DOCX ou TXT.");
  text = cleanText(text);
  if (text.length < 200) {
    throw new Error("Não consegui ler texto suficiente. Se o PDF for uma imagem (escaneado), cole o texto do currículo.");
  }
  return text;
}
