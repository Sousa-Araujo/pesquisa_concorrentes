"use client";

import { useRouter } from "next/navigation";
import CampoData from "@/components/CampoData";

type Item = { id: number; nome: string };
type EmpDireto = { id: number; nome: string; idCidade: number; cidade: string; regional: string };

export default function FiltrosDashboard({
  mesAno, regional, idCidade, idEmp, regionais, cidades, emps, todosEmps,
}: {
  mesAno: string;
  regional: string;
  idCidade: string;
  idEmp: string;
  regionais: string[];
  cidades: Item[];
  emps: Item[];
  /** Todos os empreendimentos ativos, para escolha direta sem percorrer a cascata. */
  todosEmps: EmpDireto[];
}) {
  const router = useRouter();

  function navegar(next: Partial<{ mes: string; regional: string; cidade: string; emp: string }>) {
    const params = new URLSearchParams({ mes: mesAno });
    if (regional) params.set("regional", regional);
    if (idCidade) params.set("cidade", idCidade);
    if (idEmp) params.set("emp", idEmp);
    Object.entries(next).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    // Reset dependente
    if (next.regional !== undefined) { params.delete("cidade"); params.delete("emp"); }
    if (next.cidade !== undefined) { params.delete("emp"); }
    router.push(`/gestor?${params.toString()}`);
  }

  // Seleção direta de empreendimento: preenche cidade/regional a partir do
  // próprio empreendimento, para os outros filtros continuarem coerentes.
  function escolherEmpreendimento(valor: string) {
    if (!valor) {
      navegar({ emp: "" });
      return;
    }
    const e = todosEmps.find((x) => String(x.id) === valor);
    const params = new URLSearchParams({ mes: mesAno });
    if (e) {
      params.set("regional", e.regional);
      params.set("cidade", String(e.idCidade));
    }
    params.set("emp", valor);
    router.push(`/gestor?${params.toString()}`);
  }

  // "Limpar" mantém a competência (eixo principal do dashboard) e zera só a
  // hierarquia Regional/Cidade/Empreendimento.
  function limpar() {
    router.push(`/gestor?mes=${mesAno}`);
  }
  const temFiltro = Boolean(regional || idCidade || idEmp);

  const mesInput = mesAno.slice(0, 7); // YYYY-MM

  // Quando há cidade selecionada, restringe a lista direta a ela; senão mostra
  // todos os empreendimentos com a cidade/regional no rótulo para desambiguar.
  const empsDiretos = idCidade
    ? todosEmps.filter((e) => String(e.idCidade) === idCidade)
    : todosEmps;

  return (
    <div className="card grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="rotulo">Competência</label>
          <CampoData tipo="mes" value={mesInput}
            onChange={(v) => v && navegar({ mes: `${v}-01` })} />
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
            <option value="">{regional ? "Todas" : "Selecione a regional…"}</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Empreendimento</label>
          <select className="campo !text-base !py-2" value={idEmp}
            onChange={(e) => escolherEmpreendimento(e.target.value)}>
            <option value="">Todos (consolidado)</option>
            {/* Cascata Regional -> Cidade -> Empreendimento, quando disponível. */}
            {idCidade
              ? emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)
              : empsDiretos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome} — {e.cidade}/{e.regional}
                  </option>
                ))}
          </select>
        </div>
      </div>

      {temFiltro && (
        <div>
          <button className="btn-ghost" onClick={limpar}>Limpar filtros</button>
        </div>
      )}
    </div>
  );
}
