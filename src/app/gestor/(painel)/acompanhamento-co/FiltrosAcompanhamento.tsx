"use client";

import { useRouter } from "next/navigation";
import CampoData from "@/components/CampoData";

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
  return (
    <div className="card grid gap-4 sm:grid-cols-3">
      <div>
        <label className="rotulo" htmlFor="aco-mes">Mês</label>
        <CampoData tipo="mes" id="aco-mes" value={mes.slice(0, 7)} onChange={(v) => v && ir({ mes: `${v}-01` })} />
      </div>
      <div>
        <label className="rotulo" htmlFor="aco-reg">Regional</label>
        <select id="aco-reg" className="campo" value={regional} onChange={(e) => ir({ regional: e.target.value })}>
          <option value="">Todas as regionais</option>
          {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="aco-tipo">Tipo</label>
        <select id="aco-tipo" className="campo" value={tipo} onChange={(e) => ir({ tipo: e.target.value })}>
          <option value="">Sousa e concorrentes</option>
          <option value="sousa">Só Sousa Araujo</option>
          <option value="concorrente">Só concorrentes</option>
        </select>
      </div>
    </div>
  );
}
