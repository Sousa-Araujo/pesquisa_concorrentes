/**
 * Acompanhamento do Cliente Oculto: quais pesquisas (visitas) foram e quais não
 * foram realizadas no mês, entre os empreendimentos Sousa e os concorrentes.
 * Regras em src/lib/domain/acompanhamentoCO.ts.
 */
import Link from "next/link";
import { exigirPagina } from "@/lib/auth/acesso";
import { acompanhamentoDoMes } from "@/lib/data/acompanhamentoCO";
import {
  foiRealizada, resumirAcompanhamento, type ItemAcompanhamento, type ResumoAcompanhamento, type SituacaoVisita,
} from "@/lib/domain/acompanhamentoCO";
import { competenciaVigente, formatarCompetenciaLonga } from "@/lib/domain/competencia";
import FiltrosAcompanhamento from "./FiltrosAcompanhamento";

export const dynamic = "force-dynamic";

const ROTULO: Record<SituacaoVisita, { texto: string; cor: string }> = {
  concluida: { texto: "Concluída", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" },
  calibragem: { texto: "Em calibragem", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  rascunho: { texto: "Em preenchimento", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  sem_visita: { texto: "Sem visita", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" },
};

const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

function Linha({ i }: { i: ItemAcompanhamento }) {
  const r = ROTULO[i.situacao];
  const quem = (
    <>
      <span className="font-medium text-ink">{i.nome}</span>
      <span className="block text-xs text-ink/50">
        {i.tipo === "sousa" ? "Sousa" : `Concorrente de ${i.referencia}`} · {i.regional}
        {i.somentePrevia ? " · só prévia" : ""}
      </span>
    </>
  );
  return (
    <li className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-2.5 text-sm first:border-t-0">
      <div className="min-w-0">
        {i.avaliacaoId && foiRealizada(i.situacao)
          ? <Link href={`/cliente-oculto/coordenador.html?id=${encodeURIComponent(i.avaliacaoId)}`} className="block hover:underline">{quem}</Link>
          : <div>{quem}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {i.dataVisita && <span className="text-xs tabular-nums text-ink/50">{dataBR(i.dataVisita)}</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.cor}`}>{r.texto}</span>
      </div>
    </li>
  );
}

function Coluna({ titulo, itens, vazio }: { titulo: string; itens: ItemAcompanhamento[]; vazio: string }) {
  return (
    <section className="card overflow-hidden p-0">
      <h2 className="border-b border-[var(--line)] px-4 py-3 text-sm font-bold text-ink">{titulo} ({itens.length})</h2>
      {itens.length === 0
        ? <p className="px-4 py-6 text-sm text-ink/50">{vazio}</p>
        : <ul>{itens.map((i) => <Linha key={`${i.tipo}-${i.id}`} i={i} />)}</ul>}
    </section>
  );
}

const VERDE = "bg-[var(--good,#0ca30c)]";
const VERMELHO = "bg-[var(--critical,#d03b3b)]";
const AMARELO = "bg-[var(--warning,#fab219)]";

function BarraSegmentada({ r }: { r: ResumoAcompanhamento }) {
  const parte = (n: number) => `${r.esperadas ? (n / r.esperadas) * 100 : 0}%`;
  return (
    <div role="img" aria-label={`${r.concluidas} concluídas, ${r.emCalibragem} em calibragem, ${r.rascunhos} em preenchimento, ${r.semVisita} sem visita`} className={`flex h-2 overflow-hidden rounded-full bg-[var(--line)]`}>
      <div className={VERDE} style={{ width: parte(r.concluidas) }} />
      <div className={`${VERDE} opacity-50`} style={{ width: parte(r.emCalibragem) }} />
      <div className={AMARELO} style={{ width: parte(r.rascunhos) }} />
      <div className={`${VERMELHO} opacity-60`} style={{ width: parte(r.semVisita) }} />
    </div>
  );
}

function Legenda({ r }: { r: ResumoAcompanhamento }) {
  const itens: [string, number, string][] = [
    ["Concluídas", r.concluidas, VERDE],
    ["Em calibragem", r.emCalibragem, `${VERDE} opacity-50`],
    ["Em preenchimento", r.rascunhos, AMARELO],
    ["Sem visita", r.semVisita, `${VERMELHO} opacity-60`],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
      {itens.map(([rot, n, cor]) => (
        <span key={rot} className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${cor}`} />
          {rot} <b className="tabular-nums text-ink">{n}</b>
        </span>
      ))}
    </div>
  );
}

export default async function AcompanhamentoCOPage({
  searchParams: sp,
}: { searchParams: Promise<{ mes?: string; regional?: string; tipo?: string }> }) {
  await exigirPagina("acompanhamentoCO");
  const q = await sp;
  const mes = /^\d{4}-\d{2}-01$/.test(q.mes ?? "") ? q.mes! : competenciaVigente();
  const todos = await acompanhamentoDoMes(mes);
  const regionais = [...new Set(todos.map((i) => i.regional))].sort();
  const regional = regionais.includes(q.regional ?? "") ? q.regional! : "";
  const tipo = q.tipo === "sousa" || q.tipo === "concorrente" ? q.tipo : "";
  const itens = todos.filter((i) => (!regional || i.regional === regional) && (!tipo || i.tipo === tipo));
  const r = resumirAcompanhamento(itens);
  const pct = Math.round(r.cumprimento * 100);
  const realizadas = itens.filter((i) => foiRealizada(i.situacao));
  const naoRealizadas = itens.filter((i) => !foiRealizada(i.situacao));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Acompanhamento do Cliente Oculto</h1>
          <p className="text-sm text-ink/50">
            Pesquisas de {formatarCompetenciaLonga(mes)}. Conta como realizada a visita já enviada pelo avaliador; visita em preenchimento ainda não conta.
          </p>
        </div>
        <FiltrosAcompanhamento mes={mes} regional={regional} tipo={tipo} regionais={regionais} />
      </div>

      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums text-ink">{pct}%</span>
          <span className="text-sm text-ink/60">de cumprimento</span>
        </div>
        <div className="grid min-w-[240px] flex-1 gap-2">
          <div className="flex justify-between text-sm text-ink/60">
            <span><b className="tabular-nums text-ink">{r.realizadas}</b> realizadas de <b className="tabular-nums text-ink">{r.esperadas}</b></span>
            <span><b className="tabular-nums text-[var(--critical,#d03b3b)]">{r.naoRealizadas}</b> faltam</span>
          </div>
          <BarraSegmentada r={r} />
          <Legenda r={r} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Coluna titulo="Realizadas" itens={realizadas} vazio="Nenhuma pesquisa realizada neste filtro." />
        <Coluna titulo="Não realizadas" itens={naoRealizadas} vazio="Todas as pesquisas esperadas foram realizadas." />
      </div>
    </div>
  );
}
