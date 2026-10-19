"use client";

/**
 * Aviso enquanto a IA lê o arquivo: spinner, tempo decorrido e o que esperar.
 * A leitura pode levar até ~2 min (com as tentativas nos modelos reserva),
 * então o contador mostra que a tela não travou.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function LendoComIA() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const tempo = segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${String(segundos % 60).padStart(2, "0")} s`;
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] px-4 py-3">
      <Loader2 size={22} className="shrink-0 text-[var(--brand-text)] motion-safe:animate-spin" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">Lendo o arquivo com IA… <span className="font-normal tabular-nums text-ink/60">{tempo}</span></p>
        <p className="text-ink/60">
          {segundos < 60
            ? "Costuma levar menos de um minuto. Não feche esta tela."
            : "O Google está lento; estamos tentando outro modelo. Pode levar até 3 minutos."}
        </p>
      </div>
    </div>
  );
}
