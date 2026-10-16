"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { LinhaAgente } from "@/lib/data/gestor";
import { criarAgente, editarAgente, definirStatusAgente } from "../../actions";

export default function GestaoAgentes({ inicial }: { inicial: LinhaAgente[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<LinhaAgente | null>(null);
  const [criando, setCriando] = useState(false);

  function recarregar() { router.refresh(); }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Agentes de campo</h1>
        <button className="btn-primary !w-auto !py-2.5 !text-base" onClick={() => setCriando(true)}>
          Cadastrar agente
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              <th className="px-4 py-3 font-medium">Última coleta</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {inicial.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                Nenhum agente cadastrado.
              </td></tr>
            )}
            {inicial.map((a) => (
              <tr key={a.id_agente} className="border-b border-black/[.04]">
                <td className="px-4 py-3 font-medium text-ink">{a.nome}</td>
                <td className="px-4 py-3 tabular-nums">{a.telefone}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    a.ativo ? "bg-[var(--good-tint)] text-[var(--good-ink)]" : "bg-black/10 text-ink/50"
                  }`}>
                    {a.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {a.ultima_coleta ? new Date(a.ultima_coleta).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost" onClick={() => setEditando(a)}>Editar</button>
                  <button className="btn-ghost"
                    onClick={async () => {
                      await definirStatusAgente(a.id_agente, !a.ativo);
                      recarregar();
                    }}>
                    {a.ativo ? "Inativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(criando || editando) && (
        <FormAgente
          agente={editando}
          onFechar={() => { setCriando(false); setEditando(null); }}
          onSalvo={() => { setCriando(false); setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function FormAgente({
  agente, onFechar, onSalvo,
}: {
  agente: LinhaAgente | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(agente?.nome ?? "");
  const [telefone, setTelefone] = useState(agente?.telefone ?? "");
  const [email, setEmail] = useState(agente?.email ?? "");
  const [ativo, setAtivo] = useState(agente?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null); setSalvando(true);
    const payload = { nome, telefone, email, ativo };
    const r = agente
      ? await editarAgente(agente.id_agente, payload)
      : await criarAgente(payload);
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  const titulo = agente ? "Editar agente" : "Cadastrar agente";
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-4 grid gap-4">
          <div>
            <label className="rotulo" htmlFor="ag-nome">Nome</label>
            <input id="ag-nome" className="campo !text-base !py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ag-tel">Telefone</label>
            <input id="ag-tel" className="campo !text-base !py-2" inputMode="tel" value={telefone}
              onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            <p className="mt-1 text-xs text-ink/40">Será normalizado (somente dígitos) e deve ser único.</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="ag-email">E-mail (opcional)</label>
            <input id="ag-email" type="email" className="campo !text-base !py-2" value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-ink/40">O código de acesso vai para este e-mail enquanto o envio por SMS não estiver ativo.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Agente ativo
          </label>
          {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{erro}</p>}
        </div>
        <div className="mt-5 flex gap-3">
          <button className="flex-1 rounded-xl border border-black/10 py-3 font-medium" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn-primary flex-1 !py-3" onClick={salvar}
            disabled={salvando || !nome.trim() || !telefone.trim()}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
    </Modal>
  );
}
