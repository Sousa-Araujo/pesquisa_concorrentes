"use client";

/**
 * Recibos do Cliente Oculto (Coordenador de Market Share e administrador):
 * um recibo por avaliador com as visitas. Fluxo: não assinado → aguardando
 * aprovação → aprovado (a pagar) → pago. Dá para devolver para correção.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import CampoData from "@/components/CampoData";
import Modal from "@/components/Modal";
import type { LinhaRecibo, StatusRecibo } from "@/lib/cliente-oculto/recibo";
import { definirAprovacao, definirPagamento, devolver } from "./actions";

const STATUS: Record<StatusRecibo, { rotulo: string; cor: string }> = {
  nao_assinado: { rotulo: "Não assinado", cor: "bg-[var(--surface-2)] text-ink/60" },
  devolvido: { rotulo: "Devolvido para correção", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  aprovado: { rotulo: "Aprovado · a pagar", cor: "bg-[var(--excep-tint)] text-[var(--excep-ink)]" },
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
  const [devolvendo, setDevolvendo] = useState<LinhaRecibo | null>(null);
  const [motivo, setMotivo] = useState("");

  const ir = (next: { status?: string; mes?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? status, m = next.mes ?? mes;
    if (s) p.set("status", s);
    if (m) p.set("mes", m);
    router.push(p.toString() ? `/gestor/recibos?${p}` : "/gestor/recibos");
  };

  const doStatus = (st: StatusRecibo) => todosDoMes.filter((r) => r.status === st);
  const soma = (st: StatusRecibo) => doStatus(st).reduce((a, r) => a + (r.valorCentavos ?? 0), 0);

  function executar(acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) {
    setErro(null);
    iniciar(async () => {
      const res = await acao();
      if (!res.ok) setErro(res.erro);
      router.refresh();
    });
  }
  const nome = (r: LinhaRecibo) => `${r.avaliador ?? "avaliador"} (${brl(r.valorCentavos)})`;
  const aprovar = (r: LinhaRecibo, sim: boolean) => {
    if (sim && !confirm(`Aprovar o recibo de ${nome(r)}?`)) return;
    executar(() => definirAprovacao(r.reciboId, sim));
  };
  const pagar = (r: LinhaRecibo, sim: boolean) => {
    if (sim && !confirm(`Marcar o recibo de ${nome(r)} como pago?`)) return;
    executar(() => definirPagamento(r.reciboId, sim));
  };
  function confirmarDevolucao() {
    if (!devolvendo) return;
    if (!motivo.trim()) { setErro("Escreva o motivo da devolução."); return; }
    const r = devolvendo;
    setDevolvendo(null);
    executar(() => devolver(r.reciboId, motivo));
    setMotivo("");
  }

  const cartoes: { st: StatusRecibo; titulo: string; sub: (n: number) => string; valor: boolean }[] = [
    { st: "aguardando_aprovacao", titulo: "A aprovar", sub: (n) => `${n} recibo(s) assinado(s)`, valor: true },
    { st: "aprovado", titulo: "A pagar", sub: (n) => `${n} recibo(s) aprovado(s)`, valor: true },
    { st: "pago", titulo: "Pago", sub: (n) => `${n} recibo(s)`, valor: true },
    { st: "nao_assinado", titulo: "Em aberto", sub: () => "recibo(s) ainda não assinado(s)", valor: false },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Recibos do Cliente Oculto</h1>
        <p className="text-sm text-ink/50">
          Um recibo por avaliador, com todas as visitas ainda não pagas. Confira, aprove e, depois do PIX, marque como pago.
        </p>
      </div>

      <div className="card grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="rec-status">Status</label>
          <select id="rec-status" className="campo" value={status} onChange={(e) => ir({ status: e.target.value })}>
            <option value="">Todos</option>
            <option value="aguardando_aprovacao">Aguardando aprovação</option>
            <option value="aprovado">Aprovado · a pagar</option>
            <option value="pago">Pago</option>
            <option value="nao_assinado">Não assinado</option>
            <option value="devolvido">Devolvido para correção</option>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <button key={c.st} type="button" className="card text-left" onClick={() => ir({ status: c.st })}>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">{c.titulo}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{c.valor ? brl(soma(c.st)) : doStatus(c.st).length}</div>
            <div className="text-sm text-ink/60">{c.sub(doStatus(c.st).length)}</div>
          </button>
        ))}
      </div>
      <p className="-mt-3 text-xs text-ink/50">{mes ? "Totais do mês escolhido." : "Totais de todos os meses."}</p>

      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Recibo</th>
              <th className="px-4 py-3 font-medium">Avaliador</th>
              <th className="px-4 py-3 font-medium">Empreendimentos</th>
              <th className="px-4 py-3 font-medium">Visitas</th>
              <th className="px-4 py-3 text-right font-medium">Valor total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/50">Nenhum recibo com esses filtros.</td></tr>
            )}
            {itens.map((r) => (
              <tr key={r.reciboId} className="border-b border-[var(--line)]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink/70">{r.reciboId.slice(0, 8).toUpperCase()}</td>
                <td className="px-4 py-3 text-ink">{r.avaliador || "—"}</td>
                <td className="px-4 py-3">{r.empreendimentos.join(", ") || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.visitas} {r.visitas === 1 ? "visita" : "visitas"}
                  <div className="text-xs text-ink/50">{r.primeiraVisita === r.ultimaVisita ? dataBR(r.primeiraVisita) : `${dataBR(r.primeiraVisita)} a ${dataBR(r.ultimaVisita)}`}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{brl(r.valorCentavos)}</td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cor}`}>{STATUS[r.status].rotulo}</span>
                  {r.status === "pago" && <div className="mt-1 text-xs text-ink/50">em {dataBR(r.pagoEm)}</div>}
                  {r.status === "aguardando_aprovacao" && <div className="mt-1 text-xs text-ink/50">assinado em {dataBR(r.assinadoEm)}</div>}
                  {r.status === "devolvido" && r.devolvidoMotivo && <div className="mt-1 max-w-[220px] text-xs text-ink/60">“{r.devolvidoMotivo}”</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="acoes-linha">
                    <a className="btn-acao" href={`/cliente-oculto/recibo.html?recibo=${encodeURIComponent(r.reciboId)}`}>
                      <FileText size={13} aria-hidden="true" />Abrir
                    </a>
                    {r.status === "aguardando_aprovacao" && (
                      <>
                        <button className="btn-acao" disabled={pendente} onClick={() => aprovar(r, true)}>Aprovar</button>
                        <button className="btn-acao btn-acao--perigo" disabled={pendente} onClick={() => { setMotivo(""); setDevolvendo(r); }}>Devolver</button>
                      </>
                    )}
                    {r.status === "aprovado" && (
                      <>
                        <button className="btn-acao" disabled={pendente} onClick={() => pagar(r, true)}>Marcar como pago</button>
                        <button className="btn-acao btn-acao--neutro" disabled={pendente} onClick={() => aprovar(r, false)}>Desfazer aprovação</button>
                      </>
                    )}
                    {r.status === "pago" && (
                      <button className="btn-acao btn-acao--neutro" disabled={pendente} onClick={() => pagar(r, false)}>Desfazer pagamento</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {devolvendo && (
        <Modal titulo="Devolver recibo para correção" largura="estreita" onFechar={() => setDevolvendo(null)}>
          <h2 className="mb-2 text-lg font-bold text-ink">Devolver recibo para correção</h2>
          <p className="mb-3 text-sm text-ink/60">
            A assinatura de {devolvendo.avaliador ?? "avaliador"} é apagada e o motivo aparece no recibo para ele corrigir e assinar de novo.
          </p>
          <label className="rotulo" htmlFor="dev-motivo">Motivo</label>
          <textarea id="dev-motivo" className="campo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: valor da visita do dia 10/10 está diferente do combinado; chave PIX incompleta." />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setDevolvendo(null)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={confirmarDevolucao}>Devolver</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
