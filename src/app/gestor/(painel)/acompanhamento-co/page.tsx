/**
 * Acompanhamento do Cliente Oculto: quais pesquisas (visitas) foram e quais não
 * foram realizadas no mês, entre os empreendimentos Sousa e os concorrentes.
 * Regras em src/lib/domain/acompanhamentoCO.ts.
 */
import Link from "next/link";
import { exigirPagina } from "@/lib/auth/acesso";
import { acompanhamentoDoMes } from "@/lib/data/acompanhamentoCO";
import { foiRealizada, resumirAcompanhamento, type ItemAcompanhamento, type SituacaoVisita } from "@/lib/domain/acompanhamentoCO";
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
      <div>
        <h1 className="text-2xl font-bold text-ink">Acompanhamento do Cliente Oculto</h1>
        <p className="text-sm text-ink/50">
          Quais pesquisas foram e quais não foram realizadas em {formatarCompetenciaLonga(mes)}. Conta como realizada a visita já enviada pelo
          avaliador; visita em preenchimento ainda não conta.
        </p>
      </div>

      <FiltrosAcompanhamento mes={mes} regional={regional} tipo={tipo} regionais={regionais} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Esperadas", String(r.esperadas), "empreendimentos e concorrentes"],
          ["Realizadas", String(r.realizadas), `${r.concluidas} concluídas · ${r.emCalibragem} em calibragem`],
          ["Não realizadas", String(r.naoRealizadas), `${r.semVisita} sem visita · ${r.rascunhos} em preenchimento`],
          ["Cumprimento", `${pct}%`, "realizadas sobre esperadas"],
        ].map(([rotulo, valor, sub]) => (
          <div key={rotulo} className="card">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">{rotulo}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink">{valor}</p>
            <p className="mt-1 text-xs text-ink/50">{sub}</p>
          </div>
        ))}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Cumprimento das pesquisas do mês">
        <div className="h-full rounded-full bg-[var(--good)]" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Coluna titulo="Realizadas" itens={realizadas} vazio="Nenhuma pesquisa realizada neste filtro." />
        <Coluna titulo="Não realizadas" itens={naoRealizadas} vazio="Todas as pesquisas esperadas foram realizadas." />
      </div>
    </div>
  );
}
