"use client";

import { useRouter } from "next/navigation";
import CampoData from "@/components/CampoData";

type Item = { id: number; nome: string };

export default function FiltrosPesquisas({
  mes, regional, idCidade, idEmp, idConc, idAgente,
  regionais, cidades, emps, concs, agentes,
}: {
  mes: string;
  regional: string;
  idCidade: string;
  idEmp: string;
  idConc: string;
  idAgente: string;
  regionais: string[];
  cidades: Item[];
  emps: Item[];
  concs: Item[];
  agentes: { id_agente: string; nome: string }[];
}) {
  const router = useRouter();

  /**
   * Reconstrói a querystring a partir do estado atual + a mudança,
   * limpando os níveis dependentes abaixo do que foi alterado e voltando
   * para a primeira página. Ausência de valor remove o parâmetro.
   */
  function navegar(next: Partial<Record<"mes" | "regional" | "cidade" | "emp" | "conc" | "agente", string>>) {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    if (regional) params.set("regional", regional);
    if (idCidade) params.set("cidade", idCidade);
    if (idEmp) params.set("emp", idEmp);
    if (idConc) params.set("conc", idConc);
    if (idAgente) params.set("agente", idAgente);

    Object.entries(next).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));

    // Cascata: alterar um nível limpa os abaixo (Regional → Cidade → Emp → Conc).
    if (next.regional !== undefined) { params.delete("cidade"); params.delete("emp"); params.delete("conc"); }
    if (next.cidade !== undefined) { params.delete("emp"); params.delete("conc"); }
    if (next.emp !== undefined) { params.delete("conc"); }

    params.delete("p"); // volta à primeira página ao filtrar
    const qs = params.toString();
    router.push(qs ? `/gestor/pesquisas?${qs}` : "/gestor/pesquisas");
  }

  const temFiltro = mes || regional || idCidade || idEmp || idConc || idAgente;

  return (
    <div className="card grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="rotulo">Competência</label>
          <CampoData tipo="mes" value={mes ? mes.slice(0, 7) : ""}
            onChange={(v) => navegar({ mes: v ? `${v}-01` : "" })} />
        </div>
        <div>
          <label className="rotulo">Regional</label>
          <select className="campo !text-base !py-2" value={regional}
            onChange={(e) => navegar({ regional: e.target.value })}>
            <option value="">Todas</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Cidade</label>
          <select className="campo !text-base !py-2" value={idCidade} disabled={!regional}
            onChange={(e) => navegar({ cidade: e.target.value })}>
            <option value="">Todas</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Empreendimento</label>
          <select className="campo !text-base !py-2" value={idEmp} disabled={!idCidade}
            onChange={(e) => navegar({ emp: e.target.value })}>
            <option value="">Todos</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Concorrente</label>
          <select className="campo !text-base !py-2" value={idConc} disabled={!idEmp}
            onChange={(e) => navegar({ conc: e.target.value })}>
            <option value="">Todos</option>
            {concs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Agente</label>
          <select className="campo !text-base !py-2" value={idAgente}
            onChange={(e) => navegar({ agente: e.target.value })}>
            <option value="">Todos</option>
            {agentes.map((a) => <option key={a.id_agente} value={a.id_agente}>{a.nome}</option>)}
          </select>
        </div>
      </div>

      {temFiltro && (
        <div>
          <button className="btn-ghost" onClick={() => router.push("/gestor/pesquisas")}>
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
