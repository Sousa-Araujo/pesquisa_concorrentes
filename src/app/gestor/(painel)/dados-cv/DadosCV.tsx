"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { salvarLigacao, sincronizarAgora } from "./actions";

export interface LinhaCV {
  id: number; nome: string; regional: string; idCv: number | null; manual: boolean;
  estoque: number | null; reservadas: number | null; vendas: number | null;
  ticketTabela: number | null; ticketDesconto: number | null; origem: string | null;
}

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const dataHora = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default function DadosCV({ linhas, opcoes, erroCV, mesRotulo, sincronizacao }: {
  linhas: LinhaCV[];
  opcoes: { id: number; nome: string; regiao: string | null }[];
  erroCV: string | null;
  mesRotulo: string;
  sincronizacao: { em: string | null; ok: boolean | null; mensagem: string | null } | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const rodar = (f: () => Promise<{ ok: boolean; mensagem: string }>) => {
    setAviso(null);
    iniciar(async () => {
      const r = await f();
      setAviso(r.mensagem);
      router.refresh();
    });
  };
  const ligados = linhas.filter((l) => l.idCv).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dados do CV</h1>
          <p className="text-sm text-ink/50">
            Estoque, vendas e preços dos empreendimentos Sousa vêm do BI comercial do CV a cada 30 minutos. Estoque = disponíveis + reservadas.
          </p>
        </div>
        <button className="btn-primary btn-cabecalho" disabled={pendente || !!erroCV} onClick={() => rodar(sincronizarAgora)}>
          <RefreshCw size={14} className={pendente ? "motion-safe:animate-spin" : ""} aria-hidden="true" />Sincronizar agora
        </button>
      </div>

      {erroCV && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erroCV}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">Última sincronização</div>
          <div className="mt-1 text-lg font-bold text-ink">{dataHora(sincronizacao?.em ?? null)}</div>
          <div className={`text-sm ${sincronizacao?.ok === false ? "text-[var(--critical-ink)]" : "text-ink/60"}`}>{sincronizacao?.mensagem ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">Ligados ao CV</div>
          <div className="mt-1 text-lg font-bold text-ink">{ligados} de {linhas.length}</div>
          <div className="text-sm text-ink/60">empreendimentos ativos</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">Mês</div>
          <div className="mt-1 text-lg font-bold capitalize text-ink">{mesRotulo}</div>
          <div className="text-sm text-ink/60">o fechamento do mês vira a foto do estoque</div>
        </div>
      </div>
      {aviso && <p className="text-sm text-ink/70" role="status">{aviso}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Empreendimento</th>
              <th className="px-4 py-3 font-medium">No CV</th>
              <th className="px-4 py-3 text-right font-medium">Estoque</th>
              <th className="px-4 py-3 text-right font-medium">Vendas no mês</th>
              <th className="px-4 py-3 text-right font-medium">Ticket tabela</th>
              <th className="px-4 py-3 text-right font-medium">Ticket c/ desconto</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-[var(--line)]">
                <td className="px-4 py-3"><span className="font-medium text-ink">{l.nome}</span><span className="block text-xs text-ink/50">{l.regional}</span></td>
                <td className="px-4 py-3">
                  <select className="campo !min-h-[32px] !py-1" disabled={pendente || !!erroCV}
                    value={l.idCv ? String(l.idCv) : ""}
                    onChange={(e) => rodar(() => salvarLigacao(l.id, e.target.value))}
                    aria-label={`Empreendimento do CV para ${l.nome}`}>
                    <option value="">Sem ligação</option>
                    {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.regiao ? ` (${o.regiao})` : ""}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-ink/50">
                    {l.manual ? <>Escolhido à mão · <button className="underline" disabled={pendente} onClick={() => rodar(() => salvarLigacao(l.id, "auto"))}>voltar ao automático</button></> : "Automático pelo nome"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {l.estoque ?? "—"}
                  {l.reservadas ? <span className="block text-xs text-ink/50">{l.reservadas} reserv.</span> : null}
                  {l.origem === "manual" && <span className="block text-xs text-[var(--warning-ink)]">digitado à mão</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{l.vendas ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(l.ticketTabela)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(l.ticketDesconto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
