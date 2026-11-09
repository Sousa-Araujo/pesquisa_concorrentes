"use client";

/**
 * Aviso enquanto a IA lê o arquivo, em etapas: "Arquivo recebido…",
 * "IA lendo o arquivo…", "Quase lá…" (quando a leitura passa de alguns
 * segundos) e "Concluído", logo antes de a tela atualizar com o resultado.
 */
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type EtapaLeitura = "recebido" | "lendo" | "concluido";

const ETAPAS = ["Arquivo recebido…", "IA lendo o arquivo…", "Quase lá…", "Concluído!"];

export default function LendoComIA({ etapa }: { etapa: EtapaLeitura }) {
  const [quaseLa, setQuaseLa] = useState(false);
  useEffect(() => {
    if (etapa !== "lendo") return;
    const t = setTimeout(() => setQuaseLa(true), 15_000);
    return () => clearTimeout(t);
  }, [etapa]);
  const atual = etapa === "recebido" ? 0 : etapa === "concluido" ? 3 : quaseLa ? 2 : 1;
  return (
    <div role="status" aria-live="polite" className="rounded-lg bg-[var(--surface-2)] px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        {atual < 3
          ? <Loader2 size={18} className="shrink-0 text-[var(--brand-text)] motion-safe:animate-spin" aria-hidden="true" />
          : <Check size={18} className="shrink-0 text-[var(--good-ink)]" aria-hidden="true" />}
        {ETAPAS[atual]}
      </p>
      <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i < atual ? "text-[var(--good-ink)]" : i === atual ? "font-semibold text-ink" : "text-ink/40"}>
            {i < atual ? "✓ " : ""}{e.replace("…", "").replace("!", "")}
          </li>
        ))}
      </ol>
    </div>
  );
}
