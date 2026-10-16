"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { LinhaEmpreendimento } from "@/lib/data/gestor";
import { actCidades } from "@/app/agente/actions";
import {
  criarEmpreendimento,
  editarEmpreendimento,
  definirStatusEmpreendimento,
} from "../../actions";

type Cidade = { id: number; nome: string };

export default function GestaoEmpreendimentos({
  regional, idCidade, regionais, cidades, itens,
}: {
  regional: string;
  idCidade: string;
  regionais: string[];
  cidades: Cidade[];
  itens: LinhaEmpreendimento[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinhaEmpreendimento | null>(null);

  function navegar(next: Partial<{ regional: string; cidade: string }>) {
    const params = new URLSearchParams();
    if (regional) params.set("regional", regional);
    if (idCidade) params.set("cidade", idCidade);
    Object.entries(next).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (next.regional !== undefined) params.delete("cidade");
    const qs = params.toString();
    router.push(qs ? `/gestor/empreendimentos?${qs}` : "/gestor/empreendimentos");
  }

  function recarregar() { router.refresh(); }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Empreendimentos</h1>
        <button className="btn-primary !w-auto !py-2.5 !text-base" onClick={() => setCriando(true)}>
          Cadastrar empreendimento
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
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Empreendimento</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 font-medium">Regional</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                Nenhum empreendimento encontrado.
              </td></tr>
            )}
            {itens.map((e) => (
              <tr key={e.id_empreendimento} className="border-b border-black/[.04]">
                <td className="px-4 py-3 tabular-nums text-ink/60">{e.id_empreendimento}</td>
                <td className="px-4 py-3 font-medium text-ink">{e.empreendimento}</td>
                <td className="px-4 py-3">{e.cidade}</td>
                <td className="px-4 py-3">{e.regional}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    e.ativo ? "bg-[var(--good-tint)] text-[var(--good-ink)]" : "bg-black/10 text-ink/50"
                  }`}>
                    {e.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost" onClick={() => setEditando(e)}>Editar</button>
                  <button className="btn-ghost"
                    onClick={async () => {
                      await definirStatusEmpreendimento(e.id_empreendimento, !e.ativo);
                      recarregar();
                    }}>
                    {e.ativo ? "Inativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(criando || editando) && (
        <FormEmpreendimento
          empreendimento={editando}
          regionais={regionais}
          onFechar={() => { setCriando(false); setEditando(null); }}
          onSalvo={() => { setCriando(false); setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function FormEmpreendimento({
  empreendimento, regionais, onFechar, onSalvo,
}: {
  empreendimento: LinhaEmpreendimento | null;
  regionais: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editandoExistente = Boolean(empreendimento);
  const [id, setId] = useState(empreendimento ? String(empreendimento.id_empreendimento) : "");
  const [nome, setNome] = useState(empreendimento?.empreendimento ?? "");
  const [regional, setRegional] = useState(empreendimento?.regional ?? "");
  const [idCidade, setIdCidade] = useState(empreendimento ? String(empreendimento.id_cidade) : "");
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [ativo, setAtivo] = useState(empreendimento?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Carrega as cidades da regional selecionada (inclusive ao abrir para editar).
  useEffect(() => {
    if (!regional) { setCidades([]); return; }
    actCidades(regional).then((cs) =>
      setCidades(cs.map((c) => ({ id: c.id_cidade, nome: c.cidade }))),
    );
  }, [regional]);

  async function salvar() {
    setErro(null);
    if (!nome.trim() || !regional || !idCidade || (!editandoExistente && !id)) {
      setErro("Preencha todos os campos.");
      return;
    }
    setSalvando(true);
    const r = editandoExistente
      ? await editarEmpreendimento(empreendimento!.id_empreendimento, {
          id_cidade: Number(idCidade), empreendimento: nome, ativo,
        })
      : await criarEmpreendimento({
          id_empreendimento: Number(id), id_cidade: Number(idCidade), empreendimento: nome, ativo,
        });
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  const titulo = editandoExistente ? "Editar empreendimento" : "Cadastrar empreendimento";
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-4 grid gap-4">
        <div>
          <label className="rotulo" htmlFor="emp-id">ID do empreendimento</label>
          <input id="emp-id" className="campo !text-base !py-2" inputMode="numeric" pattern="[0-9]*"
            value={id} disabled={editandoExistente}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} />
          <p className="mt-1 text-xs text-ink/40">
            {editandoExistente
              ? "Não pode ser alterado: é o prefixo dos IDs dos concorrentes."
              : "Código de origem do empreendimento. Vira o prefixo dos IDs dos concorrentes."}
          </p>
        </div>
        <div>
          <label className="rotulo" htmlFor="emp-nome">Nome</label>
          <input id="emp-nome" className="campo !text-base !py-2" value={nome}
            onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rotulo">Regional</label>
            <select className="campo !text-base !py-2" value={regional}
              onChange={(e) => { setRegional(e.target.value); setIdCidade(""); }}>
              <option value="">Selecione…</option>
              {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo">Cidade</label>
            <select className="campo !text-base !py-2" value={idCidade} disabled={!regional}
              onChange={(e) => setIdCidade(e.target.value)}>
              <option value="">Selecione…</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Empreendimento ativo
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{erro}</p>}
      </div>
      <div className="mt-5 flex gap-3">
        <button className="flex-1 rounded-xl border border-black/10 py-3 font-medium" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn-primary flex-1 !py-3" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
