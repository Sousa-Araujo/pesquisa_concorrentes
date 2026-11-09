"use client";

import { useRouter } from "next/navigation";
import CampoData from "@/components/CampoData";

type Emp = { id: number; nome: string; cidade: string; regional: string };

export default function FiltrosComparativo({ mes, idEmp, emps }: { mes: string; idEmp: number; emps: Emp[] }) {
  const router = useRouter();
  const ir = (next: { mes?: string; emp?: string }) => {
    const p = new URLSearchParams({ mes: next.mes ?? mes, emp: next.emp ?? String(idEmp) });
    router.push(`/gestor/comparativo?${p.toString()}`);
  };
  const regionais = [...new Set(emps.map((e) => e.regional))].sort();
  return (
    <div className="card grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        <label className="rotulo" htmlFor="cmp-emp">Empreendimento Sousa Araujo</label>
        <select id="cmp-emp" className="campo" value={idEmp} onChange={(e) => ir({ emp: e.target.value })}>
          {regionais.map((r) => (
            <optgroup key={r} label={r}>
              {emps.filter((e) => e.regional === r).map((e) => (
                <option key={e.id} value={e.id}>{e.nome} — {e.cidade}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="cmp-mes">Competência</label>
        <CampoData tipo="mes" id="cmp-mes" value={mes.slice(0, 7)} onChange={(v) => v && ir({ mes: `${v}-01` })} />
      </div>
    </div>
  );
}
