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
}

export interface AnalyzeResponse {
  result: AnalysisResult;
  provider: "gemini" | "groq";
}

export interface ApiError {
  error: string;
}
