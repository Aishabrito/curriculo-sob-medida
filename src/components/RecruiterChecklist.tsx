import type { Check, CheckLevel } from "../lib/recruiterChecks";

const ICON: Record<CheckLevel, string> = { ok: "✓", atencao: "!", problema: "✕" };

export default function RecruiterChecklist({ checks }: { checks: Check[] }) {
  const toFix = checks.filter((c) => c.level !== "ok");
  return (
    <>
      <p className="muted">
        {toFix.length
          ? `Quem recruta bate o olho em uns 6 segundos. ${toFix.length} coisa(s) para ajustar antes de enviar — sem IA, conferido aqui mesmo.`
          : "Passou em tudo que quem recruta confere nos primeiros segundos."}
      </p>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.id} className={`check check-${c.level}`}>
            <span className="check-icon" aria-hidden>{ICON[c.level]}</span>
            <div>
              <strong>{c.title}</strong>
              <p>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {toFix.some((c) => c.id === "dados" || c.id === "email" || c.id === "foto" || c.id === "links") && (
        <p className="muted small-note">Dados de contato e foto não são mudados pela IA: ajuste direto no seu arquivo.</p>
      )}
    </>
  );
}
