"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import CampoData from "@/components/CampoData";
import type { LinhaConcorrente } from "@/lib/data/gestor";
import { actCidades, actEmpreendimentos } from "@/app/agente/actions";
import {
  criarConcorrenteGestor,
  editarConcorrente,
  definirStatusConcorrente,
} from "../../actions";

type Item = { id: number; nome: string };

export default function GestaoConcorrentes({
  regional, idCidade, idEmp, regionais, cidades, emps, itens,
}: {
  regional: string;
  idCidade: string;
  idEmp: string;
  regionais: string[];
  cidades: Item[];
  emps: Item[];
  itens: LinhaConcorrente[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinhaConcorrente | null>(null);

  function navegar(next: Partial<{ regional: string; cidade: string; emp: string }>) {
    const params = new URLSearchParams();
    if (regional) params.set("regional", regional);
    if (idCidade) params.set("cidade", idCidade);
    if (idEmp) params.set("emp", idEmp);
    Object.entries(next).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (next.regional !== undefined) { params.delete("cidade"); params.delete("emp"); }
    if (next.cidade !== undefined) params.delete("emp");
    const qs = params.toString();
    router.push(qs ? `/gestor/concorrentes?${qs}` : "/gestor/concorrentes");
  }

  function recarregar() { router.refresh(); }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Concorrentes</h1>
        <button className="btn-primary btn-cabecalho" onClick={() => setCriando(true)}>
          Cadastrar concorrente
        </button>
      </div>

      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo">Regional</label>
          <select className="campo !px-2 !py-2 !text-sm" value={regional}
            onChange={(e) => navegar({ regional: e.target.value })}>
            <option value="">Todas</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Cidade</label>
          <select className="campo !px-2 !py-2 !text-sm" value={idCidade} disabled={!regional}
            onChange={(e) => navegar({ cidade: e.target.value })}>
            <option value="">Todas</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Empreendimento</label>
          <select className="campo !px-2 !py-2 !text-sm" value={idEmp} disabled={!idCidade}
            onChange={(e) => navegar({ emp: e.target.value })}>
            <option value="">Todos</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Concorrente</th>
              <th className="px-4 py-3 font-medium">Empreendimento</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 font-medium">Regional</th>
              <th className="px-4 py-3 font-medium">Lançamento</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                Nenhum concorrente encontrado.
              </td></tr>
            )}
            {itens.map((c) => (
              <tr key={c.id_concorrente} className="border-b border-black/[.04]">
                <td className="px-4 py-3 tabular-nums text-ink/60">{c.id_concorrente}</td>
                <td className="px-4 py-3 font-medium text-ink">{c.concorrente}</td>
                <td className="px-4 py-3">{c.empreendimento}</td>
                <td className="px-4 py-3">{c.cidade}</td>
                <td className="px-4 py-3">{c.regional}</td>
                <td className="px-4 py-3 tabular-nums text-ink/70">{c.data_lancamento ? `${c.data_lancamento.slice(8, 10)}/${c.data_lancamento.slice(5, 7)}/${c.data_lancamento.slice(0, 4)}` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    c.ativo ? "bg-[var(--good-tint)] text-[var(--good-ink)]" : "bg-black/10 text-ink/50"
                  }`}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3"><div className="acoes-linha">
                  <button className="btn-acao" onClick={() => setEditando(c)}><Pencil size={13} aria-hidden="true" />Editar</button>
                  <button className="btn-acao btn-acao--neutro"
                    onClick={async () => {
                      await definirStatusConcorrente(c.id_concorrente, !c.ativo);
                      recarregar();
                    }}>
                    {c.ativo ? "Inativar" : "Ativar"}
                  </button>
                </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(criando || editando) && (
        <FormConcorrente
          concorrente={editando}
          regionais={regionais}
          onFechar={() => { setCriando(false); setEditando(null); }}
          onSalvo={() => { setCriando(false); setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function FormConcorrente({
  concorrente, regionais, onFechar, onSalvo,
}: {
  concorrente: LinhaConcorrente | null;
  regionais: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editandoExistente = Boolean(concorrente);
  const [nome, setNome] = useState(concorrente?.concorrente ?? "");
  const [ativo, setAtivo] = useState(concorrente?.ativo ?? true);
  const [lancamento, setLancamento] = useState(concorrente?.data_lancamento ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Hierarquia só é escolhida ao criar; ao editar, o empreendimento pai é fixo
  // (o ID do concorrente carrega o prefixo dele — seção 12).
  const [regional, setRegional] = useState("");
  const [idCidade, setIdCidade] = useState("");
  const [idEmp, setIdEmp] = useState("");
  const [cidades, setCidades] = useState<Item[]>([]);
  const [emps, setEmps] = useState<Item[]>([]);

  useEffect(() => {
    if (!regional) { setCidades([]); return; }
    actCidades(regional).then((cs) =>
      setCidades(cs.map((c) => ({ id: c.id_cidade, nome: c.cidade }))),
    );
  }, [regional]);

  useEffect(() => {
    if (!idCidade) { setEmps([]); return; }
    actEmpreendimentos(Number(idCidade)).then((es) =>
      setEmps(es.map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento }))),
    );
  }, [idCidade]);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Informe o nome do concorrente."); return; }
    if (!editandoExistente && !idEmp) { setErro("Selecione Regional, Cidade e Empreendimento."); return; }

    setSalvando(true);
    const r = editandoExistente
      ? await editarConcorrente(concorrente!.id_concorrente, { concorrente: nome, ativo, data_lancamento: lancamento || null })
      : await criarConcorrenteGestor({ id_empreendimento: Number(idEmp), nome, data_lancamento: lancamento || null });
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  const titulo = editandoExistente ? "Editar concorrente" : "Cadastrar concorrente";
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-4 grid gap-4">
        {editandoExistente ? (
          // Contexto do empreendimento pai, somente leitura (seção 13: mostrar
          // a hierarquia, mesmo quando não é editável).
          <div className="rounded-lg bg-black/[.03] px-3 py-2 text-sm text-ink/70">
            <p>{concorrente!.regional} · {concorrente!.cidade}</p>
            <p className="font-medium text-ink">{concorrente!.empreendimento}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="rotulo">Regional</label>
              <select className="campo !text-sm !py-2" value={regional}
                onChange={(e) => { setRegional(e.target.value); setIdCidade(""); setIdEmp(""); }}>
                <option value="">Selecione…</option>
                {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo">Cidade</label>
              <select className="campo !text-sm !py-2" value={idCidade} disabled={!regional}
                onChange={(e) => { setIdCidade(e.target.value); setIdEmp(""); }}>
                <option value="">Selecione…</option>
                {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo">Empreendimento</label>
              <select className="campo !text-sm !py-2" value={idEmp} disabled={!idCidade}
                onChange={(e) => setIdEmp(e.target.value)}>
                <option value="">Selecione…</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="rotulo" htmlFor="conc-nome">Nome do concorrente</label>
          <input id="conc-nome" className="campo !text-base !py-2" value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()} />
          {!editandoExistente && (
            <p className="mt-1 text-xs text-ink/40">O código é gerado automaticamente.</p>
          )}
        </div>
        <div>
          <label className="rotulo" htmlFor="conc-lancamento">Data de lançamento</label>
          <CampoData tipo="data" id="conc-lancamento" className="campo !text-base !py-2" value={lancamento} onChange={setLancamento} />
          <p className="mt-1 text-xs text-ink/40">Opcional.</p>
        </div>
        {editandoExistente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Concorrente ativo
          </label>
        )}
        {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{erro}</p>}
      </div>
      <div className="mt-5 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" onClick={salvar} disabled={salvando || !nome.trim()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
