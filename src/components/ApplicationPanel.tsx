import { useState } from "react";
import type { Application, ExtraBase } from "../../shared/types";
import { demoApplication } from "../demo/extras";
import { requestExtra } from "../lib/session";
import CopyButton from "./CopyButton";

interface Props {
  base: ExtraBase;
  recruiterMessage: string;
  demo?: boolean;
}

export default function ApplicationPanel({ base, recruiterMessage, demo }: Props) {
  const [app, setApp] = useState<Application | null>(null);
  const [madeFor, setMadeFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stale = app && madeFor !== base.resume;

  async function generate() {
    setLoading(true);
    setError("");
    try {
      setApp(demo ? demoApplication : await requestExtra({ task: "candidatura", ...base }));
      setMadeFor(base.resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui gerar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {recruiterMessage && (
        <div className="app-block">
          <div className="section-head">
            <h3>Mensagem rápida no LinkedIn</h3>
            <CopyButton text={recruiterMessage} />
          </div>
          <p className="message">{recruiterMessage}</p>
        </div>
      )}

      {!app ? (
        <div className="cta-box">
          <p>
            <strong>E-mail de candidatura e carta de apresentação</strong>
            <br />
            <span className="muted">Feitos a partir do currículo com as mudanças que você aceitou. Nada inventado.</span>
          </p>
          <button type="button" className="primary small" onClick={generate} disabled={loading}>
            {loading ? "Escrevendo…" : "Gerar e-mail e carta"}
          </button>
        </div>
      ) : (
        <>
          {stale && (
            <p className="note-warn">
              Você mudou o currículo depois de gerar.{" "}
              <button type="button" className="link-button small" onClick={generate} disabled={loading}>
                {loading ? "Escrevendo…" : "Gerar de novo"}
              </button>
            </p>
          )}
          <div className="app-block">
            <div className="section-head">
              <h3>E-mail de candidatura</h3>
              <CopyButton text={`${app.subject}\n\n${app.email}`} label="Copiar e-mail" />
            </div>
            {app.subject && (
              <p className="subject">
                <span className="muted">Assunto:</span> {app.subject}
              </p>
            )}
            <p className="message">{app.email}</p>
          </div>
          <div className="app-block">
            <div className="section-head">
              <h3>Carta de apresentação</h3>
              <CopyButton text={app.coverLetter} label="Copiar carta" />
            </div>
            <p className="message">{app.coverLetter}</p>
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
