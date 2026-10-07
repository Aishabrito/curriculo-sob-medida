import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import CopyButton from "../components/CopyButton";
import SuggestionCard from "../components/SuggestionCard";
import { atsReport } from "../lib/ats";
import { findCliches, humanScore } from "../lib/cliches";
import { checkEvidence } from "../lib/evidence";
import { downloadResumePdf } from "../lib/pdf";
import { buildFinalResume, resumeToText, type Decisions, type SuggestionState } from "../lib/resume";
import { loadSession, saveSession, type Session } from "../lib/session";

const STATUS_LABEL = { tinha: "já tinha", adicionada: "adicionada", faltando: "faltando" } as const;

function Delta({ before, after, suffix = "" }: { before: number; after: number; suffix?: string }) {
  const diff = after - before;
  return (
    <span className="delta">
      <span className="delta-before">{before}{suffix}</span>
      <span aria-hidden>→</span>
      <strong>{after}{suffix}</strong>
      {diff !== 0 && <span className={diff > 0 ? "up" : "down"}>{diff > 0 ? `+${diff}` : diff}</span>}
    </span>
  );
}

export default function ResultPage() {
  const [session] = useState<Session | null>(() => loadSession());
  const [decisions, setDecisions] = useState<Decisions>(() => session?.decisions ?? {});

  useEffect(() => {
    if (session) saveSession({ ...session, decisions });
  }, [session, decisions]);

  const data = useMemo(() => {
    if (!session) return null;
    const { result, input } = session;
    const evidence = Object.fromEntries(result.suggestions.map((s) => [s.id, checkEvidence(s.evidence, input.resume)]));
    const final = buildFinalResume(result, decisions);
    const finalText = resumeToText(final);
    return {
      evidence,
      final,
      ats: atsReport(input.resume, finalText, result.keywords),
      human: { before: humanScore(input.resume), after: humanScore(finalText) },
      cliches: findCliches(finalText),
      sectionTitles: Object.fromEntries(result.sections.map((s) => [s.id, s.title])),
    };
  }, [session, decisions]);

  if (!session || !data) return <Navigate to="/" replace />;

  const { result } = session;
  const total = result.suggestions.length;
  const accepted = result.suggestions.filter((s) => decisions[s.id]?.decision === "aceita").length;
  const reviewed = result.suggestions.filter((s) => (decisions[s.id]?.decision ?? "pendente") !== "pendente").length;
  const missing = data.ats.keywords.filter((k) => k.status === "faltando");

  const setOne = (id: string, next: SuggestionState) => setDecisions((d) => ({ ...d, [id]: next }));
  const acceptAllWithProof = () =>
    setDecisions((d) => {
      const next = { ...d };
      for (const s of result.suggestions) {
        if (data.evidence[s.id] !== "sem-evidencia" && (next[s.id]?.decision ?? "pendente") === "pendente") {
          next[s.id] = { ...next[s.id], decision: "aceita" };
        }
      }
      return next;
    });

  const slug = (result.companyName || "vaga").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const download = () => downloadResumePdf(data.final, `curriculo-${slug || "vaga"}.pdf`);

  return (
    <main className="page page-result">
      <nav className="topbar">
        <Link to="/" className="link-button">← Nova análise</Link>
        {session.demo && <span className="pill pill-demo">Exemplo fictício</span>}
      </nav>

      <header className="result-head">
        <p className="eyebrow">Resultado</p>
        <h1>
          {result.jobTitle || "Sua vaga"}
          {result.companyName && <span className="muted"> · {result.companyName}</span>}
        </h1>
        <p className="lede">Revise cada mudança. Só o que você aceitar entra no PDF.</p>
      </header>

      <section className="scores" aria-label="Indicadores">
        <div className="score">
          <span className="score-label">Compatibilidade com o ATS</span>
          <Delta before={data.ats.before} after={data.ats.after} suffix="%" />
          <span className="score-hint">termos da vaga presentes no currículo</span>
        </div>
        <div className="score">
          <span className="score-label">Soa humano</span>
          <Delta before={data.human.before} after={data.human.after} />
          <span className="score-hint">sem clichês nem frases de robô</span>
        </div>
        <div className="score">
          <span className="score-label">Mudanças aceitas</span>
          <span className="delta"><strong>{accepted}</strong><span className="delta-before">de {total}</span></span>
          <span className="score-hint">{reviewed} revisadas</span>
        </div>
      </section>

      <div className="result-grid">
        <section className="review" aria-labelledby="review-title">
          <div className="section-head">
            <h2 id="review-title">Mudanças sugeridas</h2>
            <button type="button" className="btn" onClick={acceptAllWithProof}>
              Aceitar todas com prova
            </button>
          </div>
          {result.suggestions.map((s, i) => (
            <SuggestionCard
              key={s.id}
              index={i}
              suggestion={s}
              sectionTitle={data.sectionTitles[s.sectionId] ?? ""}
              evidence={data.evidence[s.id]}
              state={decisions[s.id] ?? { decision: "pendente" }}
              onChange={(next) => setOne(s.id, next)}
            />
          ))}

          <h2>Raio-X do ATS</h2>
          <p className="muted">Como um filtro automático lê seu currículo para esta vaga. A conta é feita aqui, palavra por palavra.</p>
          <ul className="chips">
            {data.ats.keywords.map(({ keyword, status }) => (
              <li key={keyword.term} className={`chip chip-${status}`}>
                {keyword.term}
                <small>{STATUS_LABEL[status]}{keyword.importance === "essencial" ? " · essencial" : ""}</small>
              </li>
            ))}
          </ul>
          {missing.length > 0 && (
            <p className="muted">
              Os termos <strong>faltando</strong> não foram colocados de propósito: você ainda não mostrou essas coisas no
              currículo. O plano abaixo ajuda a resolver isso de verdade.
            </p>
          )}

          {result.gaps.length > 0 && (
            <>
              <h2>Plano para as lacunas</h2>
              <ol className="gaps">
                {result.gaps.map((g) => (
                  <li key={g.requirement}>
                    <div className="gap-head">
                      <strong>{g.requirement}</strong>
                      {g.timeframe && <span className="pill">{g.timeframe}</span>}
                    </div>
                    <p className="muted">{g.why}</p>
                    <p>{g.action}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          {result.companyBridge && (
            <>
              <h2>Ponte com a empresa</h2>
              <blockquote className="bridge">{result.companyBridge.sentence}</blockquote>
              {result.companyBridge.valuesMatched.length > 0 && (
                <ul className="chips">
                  {result.companyBridge.valuesMatched.map((v) => (
                    <li key={v} className="chip chip-tinha">{v}</li>
                  ))}
                </ul>
              )}
              <p className="muted">Use na carta de apresentação, no "por que você quer trabalhar aqui?" ou no resumo.</p>
            </>
          )}

          {result.recruiterMessage && (
            <>
              <div className="section-head">
                <h2>Mensagem para o recrutador</h2>
                <CopyButton text={result.recruiterMessage} />
              </div>
              <p className="message">{result.recruiterMessage}</p>
            </>
          )}

          {result.interviewQuestions.length > 0 && (
            <>
              <h2>Perguntas prováveis na entrevista</h2>
              <dl className="questions">
                {result.interviewQuestions.map((q) => (
                  <div key={q.question}>
                    <dt>{q.question}</dt>
                    <dd>{q.tip}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        <aside className="preview-col" aria-label="Prévia do currículo">
          <div className="preview-sticky">
            <div className="section-head">
              <h2>Prévia</h2>
              <button type="button" className="primary small" onClick={download}>
                Baixar PDF
              </button>
            </div>
            {data.cliches.length > 0 && (
              <div className="cliche-box">
                <strong>Clichês que ainda estão no currículo</strong>
                <ul>
                  {data.cliches.map((c) => (
                    <li key={c.label}>
                      <mark className="cliche">{c.label}</mark> — {c.tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <article className="paper">
              <h3>{data.final.name}</h3>
              {data.final.headline && <p className="paper-headline">{data.final.headline}</p>}
              {data.final.contact.length > 0 && <p className="paper-contact">{data.final.contact.join(" | ")}</p>}
              {data.final.sections.map((sec) => (
                <section key={sec.title}>
                  <h4>{sec.title}</h4>
                  {sec.lines.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </section>
              ))}
            </article>
          </div>
        </aside>
      </div>

      <div className="mobile-bar">
        <span>{accepted} de {total} aceitas</span>
        <button type="button" className="primary small" onClick={download}>
          Baixar PDF
        </button>
      </div>
    </main>
  );
}
