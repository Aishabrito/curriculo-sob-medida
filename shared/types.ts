// Tipos compartilhados entre o servidor (função na Vercel) e o site.

export interface AnalyzeInput {
  job: string;
  company?: string;
  resume: string;
  /** Coisas que não estão no currículo e a pessoa quer acrescentar. */
  extra?: string;
}

export interface ResumeLine {
  id: string;
  text: string;
}

export interface ResumeSection {
  id: string;
  title: string;
  lines: ResumeLine[];
}

export interface Candidate {
  name: string;
  headline: string;
  contact: string[];
}

/**
 * Uma mudança proposta pela IA.
 * - lineId aponta para a linha original que será substituída;
 * - lineId null significa uma linha nova, adicionada em sectionId;
 * - lineId "headline" troca o título logo abaixo do nome.
 */
export interface Suggestion {
  id: string;
  sectionId: string;
  lineId: string | null;
  original: string;
  suggested: string;
  reason: string;
  /** Trecho copiado do currículo original que comprova a mudança. */
  evidence: string;
  /** Requisito da vaga que a mudança atende. */
  requirement: string;
}

export type Importance = "essencial" | "desejavel";

export interface Keyword {
  term: string;
  importance: Importance;
  synonyms: string[];
}

export interface Gap {
  requirement: string;
  why: string;
  action: string;
  timeframe: string;
}

export interface CompanyBridge {
  sentence: string;
  valuesMatched: string[];
}

export interface InterviewQuestion {
  question: string;
  tip: string;
}

export type KnockoutStatus = "tem" | "nao-tem" | "nao-claro";

/** Requisito que elimina na triagem (período, idioma, horário, local…). */
export interface Knockout {
  requirement: string;
  status: KnockoutStatus;
  /** Trecho literal do currículo que mostra que a pessoa atende. */
  evidence: string;
  /** O que fazer: deixar explícito no currículo, ou como contornar. */
  fix: string;
}

export interface AnalysisResult {
  jobTitle: string;
  companyName: string;
  candidate: Candidate;
  sections: ResumeSection[];
  suggestions: Suggestion[];
  keywords: Keyword[];
  gaps: Gap[];
  companyBridge: CompanyBridge | null;
  recruiterMessage: string;
  interviewQuestions: InterviewQuestion[];
  knockouts: Knockout[];
}

export interface AnalyzeResponse {
  result: AnalysisResult;
  provider: "gemini" | "groq";
}

// ---------------------------------------------------------------------------
// Extras sob demanda (só chamam a IA quando a pessoa clica)

export interface ExtraBase {
  job: string;
  company?: string;
  /** Currículo final, já com as mudanças aceitas. */
  resume: string;
  extra?: string;
}

export interface EnglishSource {
  headline: string;
  sections: { id: string; title: string; lines: string[] }[];
}

export type ExtraRequest =
  | ({ task: "candidatura" } & ExtraBase)
  | ({ task: "ingles"; source: EnglishSource } & ExtraBase)
  | ({ task: "entrevista"; question: string; answer: string } & ExtraBase);

export interface Application {
  subject: string;
  email: string;
  coverLetter: string;
}

export type EnglishResume = EnglishSource;

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improve: string[];
  betterAnswer: string;
}

export interface ExtraResponseMap {
  candidatura: Application;
  ingles: EnglishResume;
  entrevista: InterviewFeedback;
}

export interface ApiError {
  error: string;
}
