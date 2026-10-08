import { useState } from "react";
import type { ExtraBase, InterviewFeedback, InterviewQuestion } from "../../shared/types";
import { requestExtra } from "../lib/session";
import CopyButton from "./CopyButton";

interface Props {
  questions: InterviewQuestion[];
  base: ExtraBase;
}

function QuestionCard({ q, index, base }: { q: InterviewQuestion; index: number; base: ExtraBase }) {
  const [answer, setAnswer] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    setLoading(true);
    setError("");
    try {
      setFeedback(await requestExtra({ task: "entrevista", ...base, question: q.question, answer }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui avaliar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="interview">
      <p className="interview-q">
        <span className="interview-n">{index + 1}</span>
        {q.question}
      </p>
      {q.tip && (
        <button type="button" className="link-button small" onClick={() => setShowTip((s) => !s)} aria-expanded={showTip}>
          {showTip ? "Esconder dica" : "Ver dica"}
        </button>
      )}
      {showTip && <p className="interview-tip">{q.tip}</p>}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        maxLength={3000}
        placeholder="Escreva como você responderia falando, do seu jeito."
        aria-label={`Sua resposta para: ${q.question}`}
      />
      <div className="actions">
        <button type="button" className="btn btn-accept" onClick={ask} disabled={loading || answer.trim().length < 20}>
          {loading ? "Avaliando…" : feedback ? "Avaliar de novo" : "Receber retorno"}
        </button>
        {answer.trim().length > 0 && answer.trim().length < 20 && <span className="muted small-note">Escreva um pouco mais.</span>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {feedback && (
        <div className="feedback">
          <p className="feedback-score" aria-label={`Nota ${feedback.score} de 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < feedback.score ? "dot on" : "dot"} aria-hidden />
            ))}
            <strong>{feedback.score}/5</strong>
          </p>
          {feedback.strengths.length > 0 && (
            <>
              <h4>Mandou bem</h4>
              <ul>{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
          {feedback.improve.length > 0 && (
            <>
              <h4>Para melhorar</h4>
              <ul>{feedback.improve.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
          {feedback.betterAnswer && (
            <>
              <div className="section-head">
                <h4>Uma versão mais forte</h4>
                <CopyButton text={feedback.betterAnswer} />
              </div>
              <p className="message">{feedback.betterAnswer}</p>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function InterviewTrainer({ questions, base }: Props) {
  return (
    <>
      <p className="muted">Responda como se estivesse falando. A IA avalia pensando nesta vaga e sugere uma versão mais forte — só com fatos seus.</p>
      {questions.map((q, i) => (
        <QuestionCard key={q.question} q={q} index={i} base={base} />
      ))}
    </>
  );
}
