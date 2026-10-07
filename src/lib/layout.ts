import type { AnalysisResult } from "../../shared/types";
import { normalize } from "./text";

// Lê o "jeito" visual do PDF original (fontes, tamanhos, negrito, cores,
// margens, marcadores, alinhamento) para o PDF final sair no mesmo estilo.

export type FontFamily = "helvetica" | "times" | "courier";
export type RGB = [number, number, number];

export interface StyledLine {
  text: string;
  page: number;
  x: number;
  /** Linha de base, medida do topo da página (em pontos). */
  y: number;
  width: number;
  size: number;
  bold: boolean;
  italic: boolean;
  family: FontFamily;
  color: RGB;
}

export interface PdfLayout {
  pageWidth: number;
  pageHeight: number;
  lines: StyledLine[];
}

export interface TextStyle {
  size: number;
  bold: boolean;
  italic: boolean;
  family: FontFamily;
  color: RGB;
}

export interface StyleProfile {
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  marginTop: number;
  lineHeight: number;
  name: TextStyle;
  headline: TextStyle;
  contact: TextStyle;
  heading: TextStyle;
  body: TextStyle;
  centeredHeader: boolean;
  /** Linha fina embaixo dos títulos das seções (só no estilo padrão). */
  headingRule: boolean;
  /** Marcador usado no currículo original, ou null se não usava. */
  bullet: string | null;
  /** Para cada linha do resultado da IA (lineId), se ela tinha marcador. */
  bulletedLines: Record<string, boolean>;
  /** Para cada seção, se a maioria das linhas tinha marcador. */
  bulletedSections: Record<string, boolean>;
  /** Linhas do original com a largura medida, para ajustar o tamanho quando a fonte é trocada. */
  widthSamples: { text: string; width: number; style: TextStyle }[];
}

export type MeasureFn = (text: string, style: TextStyle) => number;

/**
 * A fonte original raramente existe no gerador de PDF (que só tem Helvetica,
 * Times e Courier). A mesma letra em 10pt pode ficar bem menor em Times do
 * que em, por exemplo, DejaVu Serif. Este fator corrige isso comparando a
 * largura real das linhas originais com a largura do mesmo texto na fonte usada.
 */
export function sizeScale(profile: StyleProfile, measure: MeasureFn): number {
  const ratios = profile.widthSamples
    .map((s) => s.width / measure(s.text, s.style))
    .filter((r) => Number.isFinite(r) && r > 0)
    .sort((a, b) => a - b);
  if (ratios.length < 2) return 1;
  const median = ratios[Math.floor(ratios.length / 2)];
  return Math.min(1.35, Math.max(0.8, median));
}

export function scaleProfile(p: StyleProfile, k: number): StyleProfile {
  if (Math.abs(k - 1) < 0.02) return { ...p, widthSamples: [] };
  const sc = (st: TextStyle): TextStyle => ({ ...st, size: +(st.size * k).toFixed(2) });
  // Sem as amostras, o perfil já ajustado não é ajustado de novo.
  return { ...p, name: sc(p.name), headline: sc(p.headline), contact: sc(p.contact), heading: sc(p.heading), body: sc(p.body), lineHeight: p.lineHeight / Math.min(k, 1.15), widthSamples: [] };
}

const BLACK: RGB = [20, 20, 20];

export const DEFAULT_PROFILE: StyleProfile = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 56,
  marginTop: 56,
  lineHeight: 1.35,
  name: { size: 20, bold: true, italic: false, family: "helvetica", color: BLACK },
  headline: { size: 11.5, bold: false, italic: false, family: "helvetica", color: BLACK },
  contact: { size: 9.5, bold: false, italic: false, family: "helvetica", color: [70, 70, 70] },
  heading: { size: 10.5, bold: true, italic: false, family: "helvetica", color: BLACK },
  body: { size: 10, bold: false, italic: false, family: "helvetica", color: BLACK },
  centeredHeader: false,
  headingRule: true,
  bullet: null,
  bulletedLines: {},
  bulletedSections: {},
  widthSamples: [],
};

export const BULLET_RE = /^\s*([-–•*▪●◦○■□➢➤►✓✔·\uf000-\uf0ff])\s*/;

const SERIF = /times|georgia|garamond|cambria|book|serif(?!-?sans)|minion|palatino|baskerville|merriweather|playfair|lora/i;
const MONO = /courier|mono|consolas|menlo/i;

export function familyFromFontName(name: string): FontFamily {
  if (MONO.test(name)) return "courier";
  if (/sans/i.test(name)) return "helvetica";
  if (SERIF.test(name)) return "times";
  return "helvetica";
}

// ---------------------------------------------------------------------------
// Leitura do PDF (roda no navegador)

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
  hasEOL: boolean;
}

interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number; convertToViewportPoint(x: number, y: number): number[] };
  getTextContent(): Promise<{ items: unknown[]; styles: Record<string, { fontFamily?: string }> }>;
  getOperatorList(): Promise<unknown>;
  commonObjs: { get(id: string): unknown; has?(id: string): boolean };
  render(params: Record<string, unknown>): { promise: Promise<void> };
}

function realFontName(page: PdfPageLike, fontName: string, fallback: string): string {
  try {
    const font = page.commonObjs.get(fontName) as { name?: string; loadedName?: string } | undefined;
    return font?.name || fallback;
  } catch {
    return fallback;
  }
}

/** Amostra a cor do texto desenhando a página num canvas e pegando os pixels mais escuros de cada linha. */
async function sampleColors(page: PdfPageLike, lines: (StyledLine & { pdfX: number; pdfY: number })[]): Promise<void> {
  if (typeof document === "undefined") return;
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  for (const line of lines) {
    const [vx, vy] = viewport.convertToViewportPoint(line.pdfX, line.pdfY);
    const w = Math.max(4, Math.min(line.width * scale, canvas.width - vx));
    const h = Math.max(4, line.size * scale * 0.75);
    const x0 = Math.max(0, Math.floor(vx));
    const y0 = Math.max(0, Math.floor(vy - h));
    const data = ctx.getImageData(x0, y0, Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h))).data;
    const px: { lum: number; c: RGB }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const c: RGB = [data[i], data[i + 1], data[i + 2]];
      const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      if (lum < 235) px.push({ lum, c });
    }
    if (!px.length) continue;
    px.sort((a, b) => a.lum - b.lum);
    const darkest = px.slice(0, Math.max(1, Math.ceil(px.length * 0.2)));
    line.color = [0, 1, 2].map((k) => Math.round(darkest.reduce((s, p) => s + p.c[k], 0) / darkest.length)) as RGB;
  }
}

export async function readPdfLayout(doc: { numPages: number; getPage(n: number): Promise<unknown> }): Promise<PdfLayout> {
  const lines: StyledLine[] = [];
  let pageWidth = DEFAULT_PROFILE.pageWidth;
  let pageHeight = DEFAULT_PROFILE.pageHeight;

  for (let n = 1; n <= doc.numPages; n++) {
    const page = (await doc.getPage(n)) as PdfPageLike;
    const vp = page.getViewport({ scale: 1 });
    if (n === 1) {
      pageWidth = vp.width;
      pageHeight = vp.height;
    }
    const content = await page.getTextContent();
    try {
      await page.getOperatorList(); // carrega as fontes para sabermos os nomes reais
    } catch {
      /* segue sem o nome real da fonte */
    }

    const items = (content.items as PdfTextItem[]).filter((it) => typeof it.str === "string");
    const pageLines: (StyledLine & { pdfX: number; pdfY: number; chars: Map<string, number> })[] = [];
    let current: (typeof pageLines)[number] | null = null;

    for (const it of items) {
      const [a, b, , , ex, ey] = it.transform;
      const size = Math.hypot(a, b) || 10;
      const sameLine = current && Math.abs(current.pdfY - ey) < size * 0.5;
      if (!sameLine && it.str.trim()) {
        current = {
          text: "",
          page: n,
          x: ex,
          y: pageHeight - ey,
          pdfX: ex,
          pdfY: ey,
          width: 0,
          size,
          bold: false,
          italic: false,
          family: "helvetica",
          color: BLACK,
          chars: new Map(),
        };
        pageLines.push(current);
      }
      if (!current) continue;
      current.text += (current.text && !current.text.endsWith(" ") && !it.str.startsWith(" ") && sameLine ? " " : "") + it.str;
      current.width = Math.max(current.width, ex + it.width - current.pdfX);
      if (it.str.trim()) {
        const fam = content.styles[it.fontName]?.fontFamily ?? "";
        const key = `${realFontName(page, it.fontName, fam)}|${size.toFixed(1)}`;
        current.chars.set(key, (current.chars.get(key) ?? 0) + it.str.length);
      }
      if (it.hasEOL) current = null;
    }

    for (const line of pageLines) {
      const [key] = [...line.chars.entries()].sort((x, y) => y[1] - x[1])[0] ?? ["|10"];
      const [font, size] = key.split("|");
      line.size = Number(size) || line.size;
      line.bold = /bold|black|heavy|semibold|demi|[-,]bd\b/i.test(font);
      line.italic = /italic|oblique/i.test(font);
      line.family = familyFromFontName(font);
      line.text = line.text.replace(/\s+/g, " ").trim();
    }

    const visible = pageLines.filter((l) => l.text);
    try {
      await sampleColors(page, visible);
    } catch {
      /* sem canvas: fica preto */
    }
    lines.push(...visible.map(({ text, page: p, x, y, width, size, bold, italic, family, color }) => ({ text, page: p, x, y, width, size, bold, italic, family, color })));
  }

  return { pageWidth, pageHeight, lines };
}

// ---------------------------------------------------------------------------
// Do layout lido para o perfil de estilo (função pura, testável)

const styleOf = (l: StyledLine): TextStyle => ({ size: l.size, bold: l.bold, italic: l.italic, family: l.family, color: l.color });
const styleKey = (s: TextStyle) => `${s.family}|${s.size.toFixed(1)}|${s.bold}|${s.italic}|${s.color.join(",")}`;

function mostCommon(lines: StyledLine[]): TextStyle | null {
  const count = new Map<string, { style: TextStyle; n: number }>();
  for (const l of lines) {
    const st = styleOf(l);
    const k = styleKey(st);
    const cur = count.get(k) ?? { style: st, n: 0 };
    cur.n += l.text.length;
    count.set(k, cur);
  }
  return [...count.values()].sort((a, b) => b.n - a.n)[0]?.style ?? null;
}

const clean = (t: string) => normalize(t.replace(BULLET_RE, ""));

/** Acha a linha visual onde começa um texto (o texto pode ter quebrado em várias linhas no PDF). */
export function findStart(lines: StyledLine[], text: string, used?: Set<StyledLine>): StyledLine | undefined {
  const key = clean(text).slice(0, 40);
  if (key.length < 2) return undefined;
  return lines.find((l) => {
    if (used?.has(l)) return false;
    const v = clean(l.text);
    if (v.length < 2) return false;
    return v.startsWith(key) || (key.startsWith(v) && v.length >= Math.min(12, key.length));
  });
}

export function buildStyleProfile(layout: PdfLayout, result: AnalysisResult): StyleProfile {
  const lines = layout.lines;
  if (!lines.length) return DEFAULT_PROFILE;
  const used = new Set<StyledLine>();
  const take = (text: string) => {
    const l = text ? findStart(lines, text, used) : undefined;
    if (l) used.add(l);
    return l;
  };

  const firstPage = lines.filter((l) => l.page === 1);
  const nameLine = take(result.candidate.name) ?? [...firstPage].sort((a, b) => b.size - a.size)[0];
  if (nameLine) used.add(nameLine);
  const headlineLine = take(result.candidate.headline);
  const contactLine = result.candidate.contact.map((c) => findStart(lines, c) ?? lines.find((l) => clean(l.text).includes(clean(c)) && clean(c).length > 3)).find(Boolean);
  if (contactLine) used.add(contactLine);

  const headingLines = result.sections.map((s) => take(s.title)).filter((l): l is StyledLine => Boolean(l));

  const bulletedLines: Record<string, boolean> = {};
  const bulletedSections: Record<string, boolean> = {};
  const bodyLines: StyledLine[] = [];
  let bullet: string | null = null;
  for (const sec of result.sections) {
    let withBullet = 0;
    for (const line of sec.lines) {
      const l = take(line.text);
      if (!l) continue;
      bodyLines.push(l);
      const m = l.text.match(BULLET_RE);
      bulletedLines[line.id] = Boolean(m);
      if (m) {
        withBullet++;
        bullet ??= m[1];
      }
    }
    bulletedSections[sec.id] = withBullet > 0 && withBullet >= sec.lines.length / 2;
  }

  const body = mostCommon(bodyLines) ?? mostCommon(lines.filter((l) => !used.has(l))) ?? DEFAULT_PROFILE.body;
  const heading = mostCommon(headingLines) ?? { ...body, bold: true };
  const name = nameLine ? styleOf(nameLine) : { ...body, size: body.size * 1.8, bold: true };
  const headline = headlineLine ? styleOf(headlineLine) : body;
  const contact = contactLine ? styleOf(contactLine) : { ...body, size: body.size * 0.92 };

  // Espaço entre linhas do corpo, medido no próprio PDF.
  const gaps: number[] = [];
  const sorted = [...bodyLines].sort((a, b) => a.page - b.page || a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].y - sorted[i - 1].y;
    if (sorted[i].page === sorted[i - 1].page && d > 0 && d < body.size * 2.2) gaps.push(d / body.size);
  }
  gaps.sort((a, b) => a - b);
  const lineHeight = gaps.length ? Math.min(1.8, Math.max(1.1, gaps[Math.floor(gaps.length / 2)])) : DEFAULT_PROFILE.lineHeight;

  const marginX = Math.min(...lines.map((l) => l.x));
  const marginTop = Math.min(...firstPage.map((l) => l.y - l.size)) || DEFAULT_PROFILE.marginTop;
  const center = (l?: StyledLine) => !!l && Math.abs(l.x + l.width / 2 - layout.pageWidth / 2) < layout.pageWidth * 0.06 && l.x > marginX + 20;

  // Linhas inteiras e sem marcador servem de régua para o tamanho da fonte.
  const widthSamples = [...bodyLines, ...headingLines]
    .filter((l) => l.text.length >= 6 && !BULLET_RE.test(l.text) && l.width > 0)
    .slice(0, 30)
    .map((l) => ({ text: l.text, width: l.width, style: styleOf(l) }));

  return {
    widthSamples,
    pageWidth: layout.pageWidth,
    pageHeight: layout.pageHeight,
    marginX: Math.max(24, Math.min(marginX, 110)),
    marginTop: Math.max(20, Math.min(marginTop, 110)),
    lineHeight,
    name,
    headline,
    contact,
    heading,
    body,
    centeredHeader: center(nameLine),
    headingRule: false,
    bullet: bullet && "•-–*·".includes(bullet) ? bullet : bullet ? "•" : null,
    bulletedLines,
    bulletedSections,
  };
}
