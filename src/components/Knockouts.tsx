import type { Knockout, KnockoutStatus } from "../../shared/types";
import { checkEvidence } from "../lib/evidence";

const LABEL: Record<KnockoutStatus, { icon: string; text: string }> = {
  tem: { icon: "✓", text: "Você atende" },
  "nao-claro": { icon: "?", text: "O currículo não deixa claro" },
  "nao-tem": { icon: "✕", text: "Você não atende" },
};

interface Props {
  knockouts: Knockout[];
  resume: string;
  extra?: string;
}

/**
 * Requisitos que eliminam na triagem. O "você atende" da IA só vale se a
 * prova citada existir mesmo no currículo — senão vira "não deixa claro".
 */
export default function Knockouts({ knockouts, resume, extra }: Props) {
  const items = knockouts.map((k) => {
    if (k.status !== "tem") return { ...k, unverified: false };
    const ok = checkEvidence(k.evidence, resume, extra) !== "sem-evidencia";
    return ok ? { ...k, unverified: false } : { ...k, status: "nao-claro" as const, unverified: true };
  });
  const order: Record<KnockoutStatus, number> = { "nao-tem": 0, "nao-claro": 1, tem: 2 };
  items.sort((a, b) => order[a.status] - order[b.status]);
  const problems = items.filter((k) => k.status !== "tem").length;

  return (
    <>
      <p className="muted">
        {problems
          ? `${problems} requisito(s) podem te cortar antes de alguém ler o resto. Resolva estes primeiro.`
          : "Você atende a tudo que costuma eliminar na triagem. Ótimo sinal."}
      </p>
      <ul className="knockouts">
        {items.map((k) => (
          <li key={k.requirement} className={`knockout ko-${k.status}`}>
            <span className="ko-icon" aria-hidden>{LABEL[k.status].icon}</span>
            <div>
              <strong>{k.requirement}</strong>
              <span className="ko-status">{LABEL[k.status].text}</span>
              {k.status === "tem" && k.evidence && <q className="ko-evidence">{k.evidence}</q>}
              {k.unverified && <p className="ko-fix">A IA achou que você atende, mas não encontrei isso escrito no seu currículo.</p>}
              {k.fix && k.status !== "tem" && <p className="ko-fix">{k.fix}</p>}
              {k.fix && k.status === "tem" && <p className="ko-fix muted">{k.fix}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
