import { findCliches } from "./cliches";
import { normalize } from "./text";

// "Olhar de recrutador em 6 segundos": o que faz um currículo de estágio ou
// júnior ser descartado rápido no Brasil. Tudo calculado aqui, sem IA.

export type CheckLevel = "ok" | "atencao" | "problema";

export interface Check {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
}

export interface CheckInput {
  /** Texto do currículo final (com as mudanças aceitas). */
  text: string;
  job: string;
  /** Número de páginas do arquivo original, se souber. */
  pages?: number;
  /** O arquivo original tem imagem (provável foto)? */
  hasImages?: boolean;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const INFORMAL_EMAIL = /(gatinh|princes|lind[oa]|fofa|fofo|bebe|bb|gostos|delici|safad|xuxu|amor|crush|diva|top|mlk|mano|zueir|loka|louc|420|666|69\b)/i;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const RG_RE = /\bRG\b[:\s]*[\dXx.\-]{5,}/i;
const CEP_RE = /\b\d{5}-\d{3}\b/;
const STREET_RE = /\b(rua|r\.|avenida|av\.|travessa|estrada|alameda)\s+[^\n,]{2,40},?\s*(n[º°o.]?\s*)?\d{1,5}/i;
const PHONE_RE = /(\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/;

const SENSITIVE: { re: RegExp; what: string }[] = [
  { re: /estado civil|\bsolteir[oa]\b|\bcasad[oa]\b|\bdivorciad[oa]\b/i, what: "estado civil" },
  { re: /data de nascimento|\bnascid[oa] em\b|\b\d{2}\s+anos\b|\bidade\b/i, what: "idade ou data de nascimento" },
  { re: /\bfilhos?\b|\bnaturalidade\b|\bnacionalidade\b|\breligi[aã]o\b/i, what: "filhos, naturalidade ou religião" },
];

const TECH_JOB = /desenvolv|programa|software|front-?end|back-?end|full-?stack|dados|data|\bti\b|tecnologia|react|javascript|python|java\b|dev\b|qa\b|automa/i;
const ENTRY_JOB = /est[aá]gi|j[uú]nior|\bjr\b|trainee|aprendiz|in[ií]cio de carreira|residência/i;

export function recruiterChecks({ text, job, pages, hasImages }: CheckInput): Check[] {
  const checks: Check[] = [];
  const add = (id: string, level: CheckLevel, title: string, detail: string) => checks.push({ id, level, title, detail });
  const words = text.split(/\s+/).filter(Boolean).length;
  const entry = ENTRY_JOB.test(job);

  // Tamanho
  const estPages = pages ?? Math.max(1, Math.ceil(words / 550));
  if (entry && estPages > 1) {
    add("paginas", "atencao", `Currículo com ${pages ? `${pages} páginas` : "mais de 1 página (estimado)"}`, "Para estágio e júnior, o ideal é 1 página. Corte o que não ajuda nesta vaga (ex.: trabalhos antigos sem relação, cursos muito curtos).");
  } else {
    add("paginas", "ok", "Tamanho bom", entry ? "Cabe em 1 página, como se espera para estágio ou júnior." : "O tamanho está adequado.");
  }

  // Contato
  const email = text.match(EMAIL_RE)?.[0];
  if (!email) add("email", "problema", "Sem e-mail", "Coloque um e-mail no topo do currículo — sem ele ninguém te chama.");
  else if (INFORMAL_EMAIL.test(email.split("@")[0])) add("email", "atencao", "E-mail pouco profissional", `"${email}" pode passar uma impressão errada. Crie um no formato nome.sobrenome@gmail.com.`);
  else add("email", "ok", "E-mail profissional", email);

  if (!PHONE_RE.test(text.replace(CPF_RE, ""))) add("telefone", "atencao", "Sem telefone", "Muitos recrutadores chamam por WhatsApp. Coloque um número com DDD.");
  else add("telefone", "ok", "Telefone presente", "Recrutadores conseguem te chamar por WhatsApp.");

  const norm = normalize(text);
  if (TECH_JOB.test(job)) {
    const hasLinkedin = norm.includes("linkedin");
    const hasGithub = norm.includes("github") || norm.includes("gitlab");
    if (!hasLinkedin || !hasGithub) {
      const miss = [!hasLinkedin && "LinkedIn", !hasGithub && "GitHub"].filter(Boolean).join(" e ");
      add("links", "atencao", `Falta link do ${miss}`, "Em vaga de tecnologia, quem recruta quer ver seu código e seu perfil. Coloque os links no topo, ao lado do e-mail.");
    } else add("links", "ok", "LinkedIn e GitHub no currículo", "Quem recruta consegue ver seu perfil e seu código.");
  }

  // Dados que não precisam estar lá
  const sensitive: string[] = [];
  if (CPF_RE.test(text)) sensitive.push("CPF");
  if (RG_RE.test(text)) sensitive.push("RG");
  if (CEP_RE.test(text) || STREET_RE.test(text)) sensitive.push("endereço completo");
  for (const s of SENSITIVE) if (s.re.test(text)) sensitive.push(s.what);
  if (sensitive.length) {
    add("dados", "problema", `Tire: ${sensitive.join(", ")}`, "Esses dados não ajudam na seleção, expõem você a golpes e podem abrir espaço para discriminação. Bairro e cidade bastam.");
  } else add("dados", "ok", "Sem dados pessoais desnecessários", "Nada de CPF, RG, endereço completo, idade ou estado civil.");

  if (hasImages) add("foto", "atencao", "O arquivo tem imagem", "Se for uma foto sua, tire: no Brasil não é pedida em tecnologia, atrapalha o ATS e abre espaço para viés. Ícones pequenos de contato não têm problema.");

  // Datas
  const year = new Date().getFullYear();
  const badRanges = [...text.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|a|até)\s*((?:19|20)\d{2})\b/g)].filter((m) => Number(m[1]) > Number(m[2]));
  const future = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1])).filter((y) => y > year + 6);
  if (badRanges.length || future.length) {
    add("datas", "atencao", "Datas estranhas", badRanges.length ? `"${badRanges[0][0]}" começa depois de terminar. Confira.` : `Ano ${future[0]} parece errado. Confira.`);
  } else add("datas", "ok", "Datas coerentes", "Nenhum período invertido ou ano impossível.");

  // Escrita
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const long = sentences.filter((s) => s.split(/\s+/).length > 35);
  if (long.length) add("frases", "atencao", `${long.length} frase(s) longa(s) demais`, `Quem lê em 6 segundos pula blocos grandes. Quebre em tópicos curtos. Começa com: "${long[0].slice(0, 70)}…"`);
  else add("frases", "ok", "Frases curtas", "Fácil de ler rápido.");

  const cliches = findCliches(text);
  if (cliches.length) add("cliches", "atencao", `Clichês: ${cliches.map((c) => c.label).join(", ")}`, "Troque adjetivos por fatos — cada clichê tem uma dica na prévia.");

  const extras = [/pretens[aã]o salarial/i, /refer[eê]ncias? (dispon[ií]veis|sob solicita)/i, /curr[ií]culo vitae/i].filter((re) => re.test(text));
  if (extras.length) add("desnecessario", "atencao", "Texto que só ocupa espaço", "Tire \"Curriculum Vitae\" do título, \"referências sob solicitação\" e pretensão salarial (só se pedirem).");

  const order: Record<CheckLevel, number> = { problema: 0, atencao: 1, ok: 2 };
  return checks.sort((a, b) => order[a.level] - order[b.level]);
}
