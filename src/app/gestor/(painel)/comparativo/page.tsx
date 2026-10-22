/**
 * Comparativo Sousa x concorrentes — dashboard da Diretoria, no modelo
 * validado com o Magno: quadro comparativo (preço, entrada, fluxo, produto,
 * estoque), estoque e velocidade de vendas, e o atendimento do Cliente Oculto.
 */
import { exigirPagina } from "@/lib/auth/acesso";
import { sincronizarSeAntigo } from "@/lib/data/sousaCV";
import { competenciaVigente, formatarCompetenciaLonga } from "@/lib/domain/competencia";
import { listarEmpreendimentosResumo } from "@/lib/data/hierarquia";
import { montarComparativo, type ColunaComparativo } from "@/lib/data/comparativo";
import { melhores, type Giro } from "@/lib/domain/comparativo";
import FiltrosComparativo from "./FiltrosComparativo";

export const dynamic = "force-dynamic";

const brl = (v: number | null) =>
  v === null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctN = (casas: number) => (v: number | null) =>
  v === null ? null : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
/** Como no modelo: desconto e VSO com 1 casa (28,6%), ato com 2 (1,75%). */
const pct = pctN(1);
const pct2 = pctN(2);
const num = (v: number | null, sufixo = "") => (v === null ? null : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${sufixo}`);

type Linha = {
  rotulo: string;
  valor: (c: ColunaComparativo) => number | null;
  fmt: (v: number | null, c: ColunaComparativo) => string | null;
  criterio?: "menor" | "maior";
  destaque?: boolean;
};

const SECOES: { nome: string; linhas: Linha[] }[] = [
  { nome: "Preço", linhas: [
    { rotulo: "Ticket líquido", valor: (c) => c.preco.ticketLiquido, fmt: brl, criterio: "menor", destaque: true },
    { rotulo: "R$/m² líquido", valor: (c) => c.preco.porM2, fmt: brl, criterio: "menor" },
    { rotulo: "Valor de tabela", valor: (c) => c.preco.valorTabela, fmt: brl, criterio: "menor" },
    { rotulo: "Desconto (%)", valor: (c) => c.preco.descontoPct, fmt: pct, criterio: "maior" },
    { rotulo: "Desconto (R$)", valor: (c) => c.preco.descontoReais, fmt: brl, criterio: "maior" },
  ] },
  { nome: "Entrada", linhas: [
    { rotulo: "Valor do ato", valor: (c) => c.preco.ato, fmt: brl, criterio: "menor" },
    { rotulo: "Ato (% do valor)", valor: (c) => c.preco.atoPct, fmt: pct2, criterio: "menor" },
  ] },
  { nome: "Fluxo", linhas: [
    { rotulo: "Parcelas pré-chaves", valor: (c) => c.parcelasPre, fmt: (v) => num(v, "x"), criterio: "maior" },
    { rotulo: "Parcelas pós-chaves", valor: (c) => c.parcelasPos, fmt: (v) => num(v, "x"), criterio: "maior" },
    { rotulo: "Prazo até entrega", valor: (c) => c.prazoEntregaMeses, fmt: (v) => (v === null ? null : v === 0 ? "Pronto" : `${v} ${v === 1 ? "mês" : "meses"}`), criterio: "menor" },
  ] },
  { nome: "Produto", linhas: [
    { rotulo: "Área da unidade", valor: (c) => c.areaM2, fmt: (v) => num(v, " m²"), criterio: "maior" },
  ] },
  { nome: "Estoque", linhas: [
    { rotulo: "VSO do mês", valor: (c) => c.vso, fmt: pct, criterio: "maior" },
    { rotulo: "Estoque (UHs)", valor: (c) => c.estoque, fmt: (v) => num(v, " UHs") },
  ] },
  { nome: "Outros", linhas: [
    { rotulo: "Entrega", valor: () => null, fmt: (_v, c) => c.entrega },
  ] },
];

const GIRO: Record<Giro, { rotulo: string; cor: string }> = {
  alto: { rotulo: "Giro alto", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" },
  moderado: { rotulo: "Giro moderado", cor: "bg-[var(--excep-tint)] text-[var(--excep-ink)]" },
  lento: { rotulo: "Giro lento", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  sem_vendas: { rotulo: "Sem vendas no mês", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" },
  sem_dados: { rotulo: "Sem dados do mês", cor: "bg-[var(--surface-2)] text-ink/60" },
};

function faixa(n: number) {
  if (n >= 9.5) return { rotulo: "Excepcional", cor: "bg-[var(--excep-tint)] text-[var(--excep-ink)]" };
  if (n >= 8) return { rotulo: "Muito bom", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" };
  if (n >= 7) return { rotulo: "Adequado", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" };
  if (n >= 5) return { rotulo: "Abaixo do esperado", cor: "bg-[var(--serious-tint)] text-[var(--serious-ink)]" };
  return { rotulo: "Crítico", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" };
}

const NI = <span className="italic text-ink/40">n/i</span>;

/** Destaque da coluna do empreendimento Sousa ("Nosso produto"), como no modelo da Diretoria. */
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-09-01" → "set/26". */
const mesCurto = (m: string) => `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

const FUNDO_SOUSA = "color-mix(in srgb, var(--brand) 9%, var(--surface))";
const FUNDO_SOUSA_TOPO = "color-mix(in srgb, var(--brand) 16%, var(--surface))";

export default async function ComparativoPage({
  searchParams: sp,
}: { searchParams: Promise<{ mes?: string; emp?: string }> }) {
  await exigirPagina("painelPesquisa");
  // Dados Sousa do BI do CV: atualiza em segundo plano se a última sincronização for antiga.
  void sincronizarSeAntigo().catch(() => {});
  const searchParams = await sp;
  const mes = /^\d{4}-\d{2}-01$/.test(searchParams.mes ?? "") ? searchParams.mes! : competenciaVigente();
  const emps = (await listarEmpreendimentosResumo()).map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento, cidade: e.cidade, regional: e.regional }));
  const idEmp = Number(searchParams.emp) || emps[0]?.id;
  const dados = idEmp ? await montarComparativo(idEmp, mes) : null;
  const cols = dados?.colunas ?? [];
  const comAtendimento = cols.filter((c) => !c.proprio && c.notaGeral !== null);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Comparativo Sousa x concorrentes</h1>
        <p className="text-sm text-ink/50">Competência: {formatarCompetenciaLonga(mes)}. Em verde, o melhor valor de cada linha.</p>
      </div>

      <FiltrosComparativo mes={mes} idEmp={idEmp ?? 0} emps={emps} />

      {!dados ? (
        <p className="card text-ink/60">Nenhum empreendimento cadastrado.</p>
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="text-lg font-bold text-ink">Quadro comparativo</h2>
            {cols.length === 1 && (
              <p className="ms-alert ms-alert--info">Este empreendimento ainda não tem concorrentes cadastrados na Pesquisa.</p>
            )}
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/50">Indicador</th>
                    {cols.map((c) => (
                      <th key={c.nome} className="px-4 py-3 text-right align-bottom"
                        style={c.proprio ? { background: FUNDO_SOUSA_TOPO } : undefined}>
                        <span className={`block font-bold ${c.proprio ? "text-[var(--brand-text)]" : "text-ink"}`}>{c.nome}</span>
                        <span className="block text-xs font-normal text-ink/50">{c.proprio ? "Nosso produto" : c.construtora ?? " "}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECOES.map((s) => [
                    <tr key={s.nome}>
                      <td colSpan={cols.length + 1} className="bg-[var(--surface-2)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink/50">{s.nome}</td>
                    </tr>,
                    ...s.linhas.map((l) => {
                      const valores = cols.map(l.valor);
                      const top = l.criterio ? melhores(valores, l.criterio) : new Set<number>();
                      return (
                        <tr key={l.rotulo} className={`border-b border-[var(--line)] ${l.destaque ? "font-semibold" : ""}`}>
                          <td className={`px-4 py-2.5 text-ink ${l.destaque ? "border-l-4 border-[var(--brand)]" : ""}`}>{l.rotulo}</td>
                          {cols.map((c, i) => {
                            const txt = l.fmt(valores[i], c);
                            return (
                              <td key={c.nome} style={c.proprio ? { background: FUNDO_SOUSA } : undefined}
                                className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${top.has(i) ? "font-bold text-[var(--good-ink)]" : "text-ink"}`}>
                                {txt ?? NI}
                                {s.nome === "Estoque" && c.mesDados && txt !== null && (
                                  <span className="block text-[11px] font-normal text-ink/50">dado de {mesCurto(c.mesDados)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }),
                  ])}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink/50">
              Preço, entrada, fluxo, área e entrega: última visita do Cliente Oculto concluída até a competência.
              Estoque e VSO: dados próprios (CV) e coletas da Pesquisa no mês; sem dado no mês, o último mês disponível, indicado abaixo do valor. n/i = não informado.
            </p>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-bold text-ink">Estoque e velocidade de vendas</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {cols.map((c) => (
                <div key={c.nome} className={`card grid content-start gap-2 ${c.proprio ? "border-2 !border-[var(--brand)]" : ""}`}
                  style={c.proprio ? { background: FUNDO_SOUSA } : undefined}>
                  <div className={`font-bold ${c.proprio ? "text-[var(--brand-text)]" : "text-ink"}`}>{c.nome}</div>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${GIRO[c.giro].cor}`}>{GIRO[c.giro].rotulo}</span>
                  {c.mesDados && <span className="text-xs text-ink/50">Sem dado no mês escolhido: último dado de {mesCurto(c.mesDados)}</span>}
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-ink/60">Estoque</dt><dd className="text-right font-semibold tabular-nums">{c.estoque !== null ? `${c.estoque} UHs` : NI}</dd>
                    <dt className="text-ink/60">Vendas no mês</dt><dd className="text-right font-semibold tabular-nums">{c.vendas !== null ? `${c.vendas} UHs` : NI}</dd>
                    <dt className="text-ink/60">VSO</dt><dd className="text-right font-semibold tabular-nums">{pct(c.vso) ?? "—"}</dd>
                    <dt className="text-ink/60">Meses p/ zerar</dt><dd className="text-right font-semibold tabular-nums">{c.mesesZerar !== null ? `~${num(c.mesesZerar)}` : c.giro === "sem_vendas" ? "sem giro" : "—"}</dd>
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Atendimento (cliente oculto)</h2>
              <p className="text-xs text-ink/50">Contexto secundário. Nota geral calibrada pelo Coordenador de Market Share.</p>
            </div>
            {comAtendimento.length === 0 ? (
              <p className="card text-sm text-ink/60">Nenhuma visita de cliente oculto concluída para os concorrentes deste empreendimento até a competência.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {comAtendimento.map((c) => {
                  const f = faixa(c.notaGeral!);
                  return (
                    <div key={c.nome} className="card grid content-start gap-2">
                      <div className="font-bold text-ink">{c.nome}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold tabular-nums text-ink">{c.notaGeral!.toFixed(1).replace(".", ",")}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${f.cor}`}>{f.rotulo}</span>
                      </div>
                      <p className="text-sm text-ink/70">{c.resumo}</p>
                      {c.visita && (
                        <a className="text-xs font-semibold text-[var(--brand-text)]" href={`/cliente-oculto/coordenador.html?id=${encodeURIComponent(c.visita.id)}`}>
                          Ver relatório {c.visita.id}{c.visita.data ? ` · visita de ${c.visita.data.split("-").reverse().join("/")}` : ""}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
