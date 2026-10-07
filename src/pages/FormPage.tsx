import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { demoInput, demoResult } from "../demo/example";
import { ACCEPTED_FILES, cleanText, extractText, type SourceFile } from "../lib/extractText";
import { requestAnalysis, saveSession } from "../lib/session";

const LOADING_STEPS = [
  "Lendo a vaga e separando o que é essencial…",
  "Procurando no seu currículo as provas de cada requisito…",
  "Reescrevendo sem inventar nada…",
  "Tirando os clichês e o jeito de robô…",
  "Montando o raio-X do ATS…",
];

export default function FormPage() {
  const navigate = useNavigate();
  const [job, setJob] = useState("");
  const [company, setCompany] = useState("");
  const [resume, setResume] = useState("");
  const [extra, setExtra] = useState("");
  const [source, setSource] = useState<SourceFile | undefined>();
  const [fileName, setFileName] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 3500);
    return () => clearInterval(t);
  }, [loading]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setReading(true);
    try {
      const out = await extractText(file);
      setResume(out.text);
      setSource(out.source);
      setFileName(file.name);
    } catch (err) {
      setResume("");
      setSource(undefined);
      setFileName("");
      setError(err instanceof Error ? err.message : "Não consegui ler o arquivo.");
    } finally {
      setReading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const input = { job: job.trim(), company: company.trim(), resume: cleanText(resume), extra: extra.trim() };
    if (input.job.length < 80) return setError("Cole a descrição completa da vaga (requisitos, atividades…).");
    if (input.resume.length < 200) return setError("Anexe seu currículo ou cole o texto dele.");
    setLoading(true);
    setStep(0);
    try {
      const result = await requestAnalysis(input);
      saveSession({ input, result, decisions: {}, source: pasteMode ? undefined : source });
      navigate("/resultado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  function openDemo() {
    saveSession({ input: demoInput, result: demoResult, decisions: {}, demo: true });
    navigate("/resultado");
  }

  return (
    <main className="page page-form">
      <header className="hero">
        <p className="eyebrow eyebrow-pill">Currículo Sob Medida</p>
        <h1>
          Seu currículo, ajustado para cada vaga — <span className="hl">sem inventar nada.</span>
        </h1>
        <p className="lede">
          Cada mudança mostra de onde veio no seu currículo e qual requisito da vaga ela atende. Você aprova uma por uma e
          baixa o PDF.
        </p>
        <button type="button" className="link-button" onClick={openDemo}>
          Ver um exemplo pronto →
        </button>
      </header>

      <form className="card form" onSubmit={onSubmit} aria-busy={loading}>
        <label className="field field-vaga">
          <span className="field-label">
            <span className="step" aria-hidden>1</span>
            Sobre a vaga <em className="required">obrigatório</em>
          </span>
          <span className="field-hint">Cole a descrição completa: atividades, requisitos, diferenciais.</span>
          <textarea
            value={job}
            onChange={(e) => setJob(e.target.value)}
            rows={8}
            placeholder="Ex.: Estágio em Desenvolvimento Front-end. Requisitos: React, JavaScript, Git…"
            required
          />
        </label>

        <label className="field field-empresa">
          <span className="field-label">
            <span className="step" aria-hidden>2</span>
            Sobre a empresa <em className="optional">opcional</em>
          </span>
          <span className="field-hint">Missão, valores, cultura, produto — do site, do LinkedIn ou da própria vaga.</span>
          <textarea
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            rows={4}
            placeholder="Ex.: Nossos valores são aprender em público, diversidade e impacto no território…"
          />
        </label>

        <div className="field field-curriculo">
          <span className="field-label">
            <span className="step" aria-hidden>3</span>
            Seu currículo <em className="required">obrigatório</em>
          </span>
          {pasteMode ? (
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={10}
              placeholder="Cole aqui o texto do seu currículo."
              aria-label="Texto do currículo"
            />
          ) : (
            <div
              className={`dropzone${dragging ? " is-dragging" : ""}${fileName ? " has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            >
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_FILES}
                hidden
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              {reading ? (
                <span>Lendo o arquivo…</span>
              ) : fileName ? (
                <>
                  <strong>{fileName}</strong>
                  <span>{resume.length.toLocaleString("pt-BR")} caracteres lidos · clique para trocar</span>
                </>
              ) : (
                <>
                  <svg className="drop-icon" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <strong>Anexe seu currículo</strong>
                  <span>Arraste aqui ou clique — PDF, DOCX ou TXT</span>
                </>
              )}
            </div>
          )}
          <button type="button" className="link-button small" onClick={() => setPasteMode((p) => !p)}>
            {pasteMode ? "Prefiro anexar um arquivo" : "Prefiro colar o texto"}
          </button>
          {!pasteMode && (
            <span className="field-hint">
              Word (.docx) mantém a formatação idêntica. PDF sai no mesmo estilo (fontes, tamanhos, cores e marcadores).
            </span>
          )}
        </div>

        <label className="field field-extra">
          <span className="field-label">
            <span className="step" aria-hidden>4</span>
            O que não está no seu currículo <em className="optional">opcional</em>
          </span>
          <span className="field-hint">
            Projetos, cursos, trabalhos, voluntariado, conquistas… Escreva do seu jeito: a IA encaixa no lugar certo e
            mostra que veio daqui.
          </span>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Ex.: Terminei o curso de TypeScript da Alura em setembro. Fiz um app de controle de gastos em React com gráficos…"
          />
        </label>

        <p className="privacy">
          🔒 O arquivo é lido no seu navegador; só o texto vai para a IA (Google Gemini, plano gratuito — que pode usar os
          textos para melhorar o modelo). Se preferir, tire telefone e endereço antes. Nada fica salvo aqui.
        </p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="primary" type="submit" disabled={loading || reading}>
          {loading ? LOADING_STEPS[step] : "Ajustar meu currículo"}
        </button>
      </form>

      <footer className="foot">
        Projeto de portfólio por{" "}
        <a href="https://github.com/aishabrito" target="_blank" rel="noreferrer">
          Aísha Brito
        </a>{" "}
        · código aberto
      </footer>
    </main>
  );
}
