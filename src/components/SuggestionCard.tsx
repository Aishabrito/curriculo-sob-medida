import { useState } from "react";
import type { Suggestion } from "../../shared/types";
import { highlightCliches } from "../lib/cliches";
import type { EvidenceStatus } from "../lib/evidence";
import type { SuggestionState } from "../lib/resume";

interface Props {
  index: number;
  suggestion: Suggestion;
  sectionTitle: string;
  evidence: EvidenceStatus;
  state: SuggestionState;
  onChange: (next: SuggestionState) => void;
}

const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  verificada: "Prova encontrada no seu currículo",
  aproximada: "Prova encontrada (com pequenas diferenças)",
  "sem-evidencia": "Não encontramos isso no seu currículo",
};

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {highlightCliches(text).map((p, i) =>
        p.cliche ? (
          <mark key={i} className="cliche" title="Clichê: troque por um fato">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function SuggestionCard({ index, suggestion: s, sectionTitle, evidence, state, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.edited ?? s.suggested);
  const current = state.edited ?? s.suggested;
  const isNew = !s.lineId;

  return (
    <article className={`suggestion is-${state.decision} ev-${evidence}`}>
      <header className="suggestion-head">
        <span className="suggestion-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="suggestion-where">
          {s.lineId === "headline" ? "Título" : sectionTitle || "Nova seção"}
          {isNew && <span className="pill">linha nova</span>}
        </span>
        {s.requirement && <span className="pill pill-req">atende: {s.requirement}</span>}
      </header>

      <div className="diff">
        {!isNew && (
          <p className="diff-before">
            <span className="diff-label">Antes</span>
            <Highlighted text={s.original} />
          </p>
        )}
        <div className="diff-after">
          <span className="diff-label">Depois</span>
          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus />
          ) : (
            <p>
              <Highlighted text={current} />
              {state.edited && <span className="pill">editado por você</span>}
            </p>
          )}
        </div>
      </div>

      <p className="why">{s.reason}</p>

      <p className={`evidence ev-${evidence}`}>
        <strong>{evidence === "sem-evidencia" ? "⚠" : "✓"} {EVIDENCE_LABEL[evidence]}</strong>
        {s.evidence && <q>{s.evidence}</q>}
        {evidence === "sem-evidencia" && <span> Só aceite se for verdade — se não for, recuse.</span>}
      </p>

      <div className="actions">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-accept"
              onClick={() => {
                const text = draft.trim();
                onChange({ decision: "aceita", edited: text && text !== s.suggested ? text : undefined });
                setEditing(false);
              }}
            >
              Salvar e aceitar
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`btn btn-accept${state.decision === "aceita" ? " is-on" : ""}`}
              aria-pressed={state.decision === "aceita"}
              onClick={() => onChange({ ...state, decision: state.decision === "aceita" ? "pendente" : "aceita" })}
            >
              {state.decision === "aceita" ? "✓ Aceita" : "Aceitar"}
            </button>
            <button
              type="button"
              className={`btn btn-reject${state.decision === "recusada" ? " is-on" : ""}`}
              aria-pressed={state.decision === "recusada"}
              onClick={() => onChange({ ...state, decision: state.decision === "recusada" ? "pendente" : "recusada" })}
            >
              {state.decision === "recusada" ? "✕ Recusada" : "Recusar"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDraft(current);
                setEditing(true);
              }}
            >
              Editar
            </button>
          </>
        )}
      </div>
    </article>
  );
}
