"use client";

import { useRouter } from "next/navigation";
import type { Leitura, StatusLeitura } from "@/lib/data/tabelas";

export const STATUS_LEITURA: Record<StatusLeitura, { rotulo: string; cor: string }> = {
  lendo: { rotulo: "Lendo", cor: "bg-[var(--surface-2)] text-ink/60" },
  para_conferir: { rotulo: "Para conferir", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  aprovada: { rotulo: "Aprovada", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" },
  recusada: { rotulo: "Recusada", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" },
};

const mesBR = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR");

export default function ListaLeituras({ leituras, filtro }: { leituras: Leitura[]; filtro: string }) {
  const router = useRouter();
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Leituras enviadas</h2>
        <select className="campo !w-auto" value={filtro} onChange={(e) => router.push(e.target.value ? `/gestor/tabelas?status=${e.target.value}` : "/gestor/tabelas")}>
          <option value="">Todas</option>
          <option value="para_conferir">Para conferir</option>
          <option value="aprovada">Aprovadas</option>
          <option value="recusada">Recusadas</option>
        </select>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Concorrente</th>
              <th className="px-4 py-3 font-medium">Mês</th>
              <th className="px-4 py-3 text-right font-medium">Estoque</th>
              <th className="px-4 py-3 text-right font-medium">Vendas</th>
              <th className="px-4 py-3 font-medium">Enviado</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {leituras.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/50">Nenhuma leitura.</td></tr>
            )}
            {leituras.map((l) => (
              <tr key={l.id} className="border-b border-[var(--line)]">
                <td className="px-4 py-3"><span className="font-medium text-ink">{l.concorrente}</span><span className="block text-xs text-ink/50">{l.empreendimento}</span></td>
                <td className="px-4 py-3">{mesBR(l.mesAno)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.resumo.totalUnidades || l.status !== "para_conferir" ? l.resumo.estoque : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.resumo.vendasMes ?? "—"}</td>
                <td className="px-4 py-3 text-ink/70">{dataBR(l.enviadoEm)}{l.enviadoPor ? <span className="block text-xs text-ink/50">{l.enviadoPor}</span> : null}</td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_LEITURA[l.status].cor}`}>{STATUS_LEITURA[l.status].rotulo}</span>
                  {l.erroIa && l.status === "para_conferir" && <span className="mt-1 block text-xs text-[var(--warning-ink)]">Sem leitura da IA</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <a className="btn-acao" href={`/gestor/tabelas/${l.id}`}>{l.status === "para_conferir" ? "Conferir" : "Abrir"}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
