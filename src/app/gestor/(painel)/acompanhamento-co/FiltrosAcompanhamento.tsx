"use client";

import { useRouter } from "next/navigation";
import CampoData from "@/components/CampoData";

/** Filtros em uma linha (mês, regional e tipo), sem rótulos visíveis. */
export default function FiltrosAcompanhamento({
  mes, regional, tipo, regionais,
}: { mes: string; regional: string; tipo: string; regionais: string[] }) {
  const router = useRouter();
  const ir = (next: { mes?: string; regional?: string; tipo?: string }) => {
    const p = new URLSearchParams({ mes: next.mes ?? mes });
    const r = next.regional ?? regional;
    const t = next.tipo ?? tipo;
    if (r) p.set("regional", r);
    if (t) p.set("tipo", t);
    router.push(`/gestor/acompanhamento-co?${p.toString()}`);
  };
  const c = "campo !py-1.5 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <CampoData tipo="mes" id="aco-mes" className={c} value={mes.slice(0, 7)} onChange={(v) => v && ir({ mes: `${v}-01` })} />
      </div>
      <select aria-label="Regional" className={`${c} w-auto`} value={regional} onChange={(e) => ir({ regional: e.target.value })}>
        <option value="">Todas as regionais</option>
        {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select aria-label="Tipo" className={`${c} w-auto`} value={tipo} onChange={(e) => ir({ tipo: e.target.value })}>
        <option value="">Sousa e concorrentes</option>
        <option value="sousa">Só Sousa Araujo</option>
        <option value="concorrente">Só concorrentes</option>
      </select>
    </div>
  );
}
