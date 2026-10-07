import { DOMParser, XMLSerializer, type Document as XDocument, type Element as XElement } from "@xmldom/xmldom";
import JSZip from "jszip";
import type { AnalysisResult } from "../../shared/types";
import { BULLET_RE } from "./layout";
import { collectEdits, isSummarySection, titleForNewSection, type Decisions } from "./resume";
import { normalize } from "./text";

// Edita o próprio arquivo Word da pessoa: só troca o texto das linhas
// aprovadas e copia um parágrafo vizinho para as linhas novas. Fonte, cor,
// tamanho, marcadores, tabelas e espaçamento continuam os do original.

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const paragraphs = (doc: XDocument) => Array.from(doc.getElementsByTagNameNS(W, "p")) as XElement[];
const textNodes = (p: XElement) => Array.from(p.getElementsByTagNameNS(W, "t")) as XElement[];
const paraText = (p: XElement) => textNodes(p).map((t) => t.textContent ?? "").join("");

/** Regex que acha o texto original ignorando diferenças de espaço e marcador. */
function flexible(text: string): RegExp | null {
  const core = text.replace(BULLET_RE, "").trim();
  if (core.length < 2) return null;
  const pattern = core
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
  return new RegExp(pattern);
}

/**
 * Troca o trecho [start, end) do texto do parágrafo mexendo o mínimo nos "runs"
 * (pedaços com formatação própria): o começo e o fim que não mudaram ficam
 * onde estão, e a parte nova entra no run que tinha mais texto do trecho antigo.
 * Assim um rótulo em negrito no início não "contamina" a frase inteira.
 */
function replaceRange(p: XElement, start: number, end: number, text: string): void {
  const nodes = textNodes(p);
  const full = nodes.map((t) => t.textContent ?? "").join("");
  const old = full.slice(start, end);
  let pre = 0;
  while (pre < old.length && pre < text.length && old[pre] === text[pre]) pre++;
  let suf = 0;
  while (suf < old.length - pre && suf < text.length - pre && old[old.length - 1 - suf] === text[text.length - 1 - suf]) suf++;
  const a0 = start + pre;
  const b0 = end - suf;
  const middle = text.slice(pre, text.length - suf);

  // Quem recebe o texto novo: o run com maior pedaço do trecho trocado
  // (ou, se for só inserção, o run onde ela acontece).
  let offset = 0;
  let target = -1;
  let best = -1;
  const spans = nodes.map((t) => {
    const a = offset;
    offset += (t.textContent ?? "").length;
    return [a, offset] as const;
  });
  spans.forEach(([a, b], i) => {
    const overlap = Math.min(b, b0) - Math.max(a, a0);
    const touches = a0 === b0 ? a <= a0 && a0 <= b : overlap > 0;
    if (touches && overlap > best) {
      best = overlap;
      target = i;
    }
  });
  if (target === -1) target = Math.max(0, nodes.length - 1);

  nodes.forEach((t, i) => {
    const [a, b] = spans[i];
    const value = t.textContent ?? "";
    const from = Math.min(Math.max(a0, a), b) - a;
    const to = Math.min(Math.max(b0, a), b) - a;
    const insert = i === target ? middle : "";
    if (from === to && !insert) return;
    t.textContent = value.slice(0, from) + insert + value.slice(to);
    t.setAttribute("xml:space", "preserve");
  });
}

/** Substitui o texto do parágrafo inteiro, mantendo um marcador digitado no começo. */
function setParagraphText(p: XElement, text: string): void {
  const current = paraText(p);
  const prefix = current.match(BULLET_RE)?.[0] ?? "";
  replaceRange(p, prefix.length, current.length, text.replace(BULLET_RE, ""));
}

function findParagraph(paras: XElement[], original: string): { p: XElement; start: number; end: number } | null {
  const re = flexible(original);
  if (re) {
    for (const p of paras) {
      const m = re.exec(paraText(p));
      if (m) return { p, start: m.index, end: m.index + m[0].length };
    }
  }
  const norm = normalize(original.replace(BULLET_RE, ""));
  for (const p of paras) {
    const full = paraText(p);
    if (norm && normalize(full.replace(BULLET_RE, "")) === norm) {
      const prefix = full.match(BULLET_RE)?.[0] ?? "";
      return { p, start: prefix.length, end: full.length };
    }
  }
  return null;
}

function insertAfter(ref: XElement, node: XElement): void {
  const parent = ref.parentNode;
  if (!parent) return;
  if (ref.nextSibling) parent.insertBefore(node, ref.nextSibling);
  else parent.appendChild(node);
}

function cloneWithText(template: XElement, text: string): XElement {
  const clone = template.cloneNode(true) as XElement;
  // Sem marcador digitado se o modelo não tinha; com o mesmo se tinha.
  setParagraphText(clone, text);
  return clone;
}

export interface DocxPatchReport {
  applied: number;
  missed: string[];
}

export async function patchDocx(
  original: ArrayBuffer | Uint8Array,
  result: AnalysisResult,
  decisions: Decisions,
): Promise<{ data: Uint8Array; report: DocxPatchReport }> {
  const zip = await JSZip.loadAsync(original);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Esse arquivo Word não tem o conteúdo esperado.");
  const doc = new DOMParser().parseFromString(await file.async("string"), "text/xml") as unknown as XDocument;
  const paras = paragraphs(doc);
  const edits = collectEdits(result, decisions);
  const report: DocxPatchReport = { applied: 0, missed: [] };

  // Localiza tudo ANTES de editar: depois de trocar um texto ele não seria mais encontrado.
  const lineHit = new Map(result.sections.flatMap((s) => s.lines.map((l) => [l.id, findParagraph(paras, l.text)] as const)));
  const titleHit = new Map(result.sections.map((s) => [s.id, findParagraph(paras, s.title)] as const));
  const headlineHit = result.candidate.headline ? findParagraph(paras, result.candidate.headline) : null;
  const known = new Map(result.sections.map((s) => [s.id, s]));
  const first = result.sections[0];
  const last = result.sections[result.sections.length - 1];
  const headingTpl = first ? titleHit.get(first.id)?.p : undefined;
  const bodyTpl = first?.lines[0] ? lineHit.get(first.lines[0].id)?.p : undefined;
  const lastSectionEnd = last ? (lineHit.get(last.lines[last.lines.length - 1]?.id ?? "") ?? titleHit.get(last.id))?.p : undefined;
  const sectionEnd = (id: string) => {
    const sec = known.get(id);
    if (!sec) return undefined;
    for (let i = sec.lines.length - 1; i >= 0; i--) {
      const hit = lineHit.get(sec.lines[i].id);
      if (hit) return hit.p;
    }
    return titleHit.get(id)?.p;
  };
  const additionAnchors = new Map([...edits.additions.keys()].map((id) => [id, sectionEnd(id)] as const));

  // 1. Linhas reescritas
  for (const [lineId, text] of edits.replacements) {
    const hit = lineHit.get(lineId);
    if (!hit) {
      report.missed.push(text);
      continue;
    }
    replaceRange(hit.p, hit.start, hit.end, text.replace(BULLET_RE, ""));
    report.applied++;
  }

  // 2. Título abaixo do nome
  if (edits.headline) {
    if (headlineHit) {
      replaceRange(headlineHit.p, headlineHit.start, headlineHit.end, edits.headline);
      report.applied++;
    } else report.missed.push(edits.headline);
  }

  // 3. Linhas novas em seções que já existem: copia a última linha da seção.
  for (const [sectionId, lines] of edits.additions) {
    if (!known.has(sectionId)) continue;
    const anchor = additionAnchors.get(sectionId);
    if (!anchor) {
      report.missed.push(...lines);
      continue;
    }
    let ref = anchor;
    for (const text of lines) {
      const node = cloneWithText(anchor, text);
      insertAfter(ref, node);
      ref = node;
      report.applied++;
    }
  }

  // 4. Seções novas (ex.: resumo profissional, cursos): copia um título e uma linha de corpo.
  for (const [sectionId, lines] of edits.additions) {
    if (known.has(sectionId)) continue;
    if (!headingTpl || !bodyTpl) {
      report.missed.push(...lines);
      continue;
    }
    const nodes = [cloneWithText(headingTpl, titleForNewSection(sectionId)), ...lines.map((t) => cloneWithText(bodyTpl, t))];
    if (isSummarySection(sectionId)) {
      for (const n of nodes) headingTpl.parentNode?.insertBefore(n, headingTpl);
    } else {
      let ref = lastSectionEnd ?? paras[paras.length - 1];
      for (const n of nodes) {
        insertAfter(ref, n);
        ref = n;
      }
    }
    report.applied += lines.length;
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc as never));
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { data, report };
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function downloadBytes(data: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
