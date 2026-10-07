import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { demoInput, demoResult } from "../demo/example";
import { ACCEPTED_FILES, cleanText, extractText } from "../lib/extractText";
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
      setResume(await extractText(file));
      setFileName(file.name);
    } catch (err) {
      setResume("");
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
    const input = { job: job.trim(), company: company.trim(), resume: cleanText(resume) };
    if (input.job.length < 80) return setError("Cole a descrição completa da vaga (requisitos, atividades…).");
    if (input.resume.length < 200) return setError("Anexe seu currículo ou cole o texto dele.");
    setLoading(true);
    setStep(0);
    try {
      const result = await requestAnalysis(input);
      saveSession({ input, result, decisions: {} });
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
        <p className="eyebrow">Currículo Sob Medida</p>
        <h1>Seu currículo, ajustado para cada vaga — sem inventar nada.</h1>
        <p className="lede">
          Cada mudança mostra de onde veio no seu currículo e qual requisito da vaga ela atende. Você aprova uma por uma e
          baixa o PDF.
        </p>
        <button type="button" className="link-button" onClick={openDemo}>
          Ver um exemplo pronto →
        </button>
      </header>

      <form className="card form" onSubmit={onSubmit} aria-busy={loading}>
        <label className="field">
          <span className="field-label">
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

        <label className="field">
          <span className="field-label">
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

        <div className="field">
          <span className="field-label">
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
                  <strong>Anexe seu currículo</strong>
                  <span>Arraste aqui ou clique — PDF, DOCX ou TXT</span>
                </>
              )}
            </div>
          )}
          <button type="button" className="link-button small" onClick={() => setPasteMode((p) => !p)}>
            {pasteMode ? "Prefiro anexar um arquivo" : "Prefiro colar o texto"}
          </button>
        </div>

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
