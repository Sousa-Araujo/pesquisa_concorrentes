"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import CampoData from "@/components/CampoData";
import type { LinhaRecibo, StatusRecibo } from "@/lib/cliente-oculto/recibo";
import { definirPagamento } from "./actions";

const STATUS: Record<StatusRecibo, { rotulo: string; cor: string }> = {
  nao_assinado: { rotulo: "Não assinado", cor: "bg-[var(--surface-2)] text-ink/60" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  pago: { rotulo: "Pago", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" },
};

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBR = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export default function GestaoRecibos({
  itens, todosDoMes, status, mes,
}: { itens: LinhaRecibo[]; todosDoMes: LinhaRecibo[]; status: string; mes: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const ir = (next: { status?: string; mes?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? status, m = next.mes ?? mes;
    if (s) p.set("status", s);
    if (m) p.set("mes", m);
    router.push(p.toString() ? `/gestor/recibos?${p}` : "/gestor/recibos");
  };

  const soma = (st: StatusRecibo) => todosDoMes.filter((r) => r.status === st).reduce((a, r) => a + (r.valorCentavos ?? 0), 0);
  const conta = (st: StatusRecibo) => todosDoMes.filter((r) => r.status === st).length;

  function pagar(r: LinhaRecibo, pago: boolean) {
    if (pago && !confirm(`Marcar o recibo ${r.avaliacaoId} (${brl(r.valorCentavos)}) como pago?`)) return;
    setErro(null);
    iniciar(async () => {
      const res = await definirPagamento(r.avaliacaoId, pago);
      if (!res.ok) setErro(res.erro);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Recibos do Cliente Oculto</h1>
        <p className="text-sm text-ink/50">Pagamentos por PIX das avaliações enviadas. Só o administrador vê esta tela.</p>
      </div>

      <div className="card grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="rec-status">Status</label>
          <select id="rec-status" className="campo" value={status} onChange={(e) => ir({ status: e.target.value })}>
            <option value="">Todos</option>
            <option value="aguardando_pagamento">Aguardando pagamento</option>
            <option value="nao_assinado">Não assinado</option>
            <option value="pago">Pago</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="rec-mes">Mês da visita</label>
          <CampoData tipo="mes" id="rec-mes" value={mes} onChange={(v) => ir({ mes: v })} />
        </div>
        {(status || mes) && (
          <button className="btn-secundario" onClick={() => router.push("/gestor/recibos")}>Limpar filtros</button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">A pagar</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{brl(soma("aguardando_pagamento"))}</div>
          <div className="text-sm text-ink/60">{conta("aguardando_pagamento")} recibo(s) assinado(s)</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">Pago</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{brl(soma("pago"))}</div>
          <div className="text-sm text-ink/60">{conta("pago")} recibo(s)</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">Sem recibo assinado</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{conta("nao_assinado")}</div>
          <div className="text-sm text-ink/60">avaliação(ões) enviada(s)</div>
        </div>
      </div>
      <p className="-mt-3 text-xs text-ink/50">{mes ? "Totais do mês escolhido." : "Totais de todos os meses."}</p>

      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Avaliação</th>
              <th className="px-4 py-3 font-medium">Avaliador</th>
              <th className="px-4 py-3 font-medium">Empreendimento</th>
              <th className="px-4 py-3 font-medium">Visita</th>
              <th className="px-4 py-3 text-right font-medium">Pesquisas</th>
              <th className="px-4 py-3 text-right font-medium">Valor total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">Nenhum recibo com esses filtros.</td></tr>
            )}
            {itens.map((r) => (
              <tr key={r.avaliacaoId} className="border-b border-[var(--line)]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink/70">{r.avaliacaoId}</td>
                <td className="px-4 py-3 text-ink">{r.avaliador || "—"}</td>
                <td className="px-4 py-3">{r.empreendimento || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{dataBR(r.dataVisita)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.quantidade ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{brl(r.valorCentavos)}</td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cor}`}>{STATUS[r.status].rotulo}</span>
                  {r.pagoEm && <div className="mt-1 text-xs text-ink/50">em {dataBR(r.pagoEm)}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="acoes-linha">
                    <a className="btn-acao" href={`/cliente-oculto/recibo.html?id=${encodeURIComponent(r.avaliacaoId)}`}>
                      <FileText size={13} aria-hidden="true" />Abrir
                    </a>
                    {r.status === "aguardando_pagamento" && (
                      <button className="btn-acao" disabled={pendente} onClick={() => pagar(r, true)}>Marcar como pago</button>
                    )}
                    {r.status === "pago" && (
                      <button className="btn-acao btn-acao--neutro" disabled={pendente} onClick={() => pagar(r, false)}>Desfazer</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
