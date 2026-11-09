/**
 * Dados dos empreendimentos Sousa vindos do BI do CV, gravados em
 * dados_proprios_mensais com origem 'cv' (regras combinadas em 2026-10-22):
 *  - estoque = disponível + reservada (bloqueadas ficam fora, como nos concorrentes);
 *  - o BI só tem a foto de hoje, então o mês atual é regravado a cada
 *    sincronização e o último retrato antes da virada vira a foto do mês;
 *  - no mês seguinte, só vendas e ticket com desconto do mês fechado são
 *    atualizados (vendas carregadas com atraso); o estoque fica;
 *  - dados digitados à mão (origem 'manual') nunca são sobrescritos.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { cvConfigurado, lerEmpreendimentosCV, lerEstoqueAtual, lerVendasMensais, type EmpreendimentoCV } from "@/lib/db/cv";
import { nomeComparavel, nomeNucleo } from "@/lib/domain/comparativo";

/** Primeiro dia do mês atual no horário de Brasília (YYYY-MM-01). */
function mesAtual(agora = new Date()): string {
  const [a, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(agora).split("-");
  return `${a}-${m}-01`;
}
function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Liga ao CV, pelo nome, os empreendimentos ainda sem ligação manual.
 * Primeiro pelo nome igual; se não achar, pelo nome sem prefixos genéricos
 * ("Residencial Safira II" = "SAFIRA II"), só quando há um único candidato.
 */
export async function ligarPorNome(cv: EmpreendimentoCV[]): Promise<number> {
  const { rows } = await db().query(`select id_empreendimento, empreendimento, id_cv from empreendimentos where not id_cv_manual`);
  const porNome = new Map(cv.map((c) => [nomeComparavel(c.nome), c.id]));
  const porNucleo = new Map<string, number | null>();
  for (const c of cv) {
    const k = nomeNucleo(c.nome);
    porNucleo.set(k, porNucleo.has(k) ? null : c.id); // null = ambíguo
  }
  let ligados = 0;
  for (const e of rows) {
    const id = porNome.get(nomeComparavel(e.empreendimento)) ?? porNucleo.get(nomeNucleo(e.empreendimento)) ?? null;
    if (id !== e.id_cv) await db().query(`update empreendimentos set id_cv = $2 where id_empreendimento = $1`, [e.id_empreendimento, id]);
    if (id) ligados++;
  }
  return ligados;
}

/**
 * Vendas do empreendimento Sousa no CV numa competência (para a tela de
 * Dados próprios). null quando o empreendimento não está ligado ao CV ou o
 * CV não respondeu.
 */
export async function vendasCVDoMes(idEmpreendimento: number, mesAno: string): Promise<number | null> {
  if (!cvConfigurado()) return null;
  const { rows: [e] } = await db().query(`select id_cv from empreendimentos where id_empreendimento = $1`, [idEmpreendimento]);
  if (!e?.id_cv) return null;
  try {
    const vendas = await lerVendasMensais([Number(e.id_cv)], mesAno);
    return vendas.find((v) => v.mesAno === mesAno)?.vendas ?? 0;
  } catch (err) {
    console.error("[cv] vendas do mês:", (err as Error).message);
    return null;
  }
}

let rodando: Promise<SincronizacaoCV> | null = null;

export interface SincronizacaoCV { ok: boolean; mensagem: string }

/** Sincroniza os dados Sousa com o CV. Chamadas simultâneas esperam a mesma execução. */
export function sincronizarSousaCV(): Promise<SincronizacaoCV> {
  if (!rodando) rodando = executar().finally(() => { rodando = null; });
  return rodando;
}

async function executar(): Promise<SincronizacaoCV> {
  if (!cvConfigurado()) return { ok: false, mensagem: "CV_DATABASE_URL não configurada." };
  let r: SincronizacaoCV;
  try {
    const cv = await lerEmpreendimentosCV();
    await ligarPorNome(cv);
    const { rows: ligados } = await db().query<{ id_empreendimento: number; id_cv: number }>(
      `select id_empreendimento, id_cv from empreendimentos where ativo and id_cv is not null`,
    );
    const idsCv = ligados.map((l) => l.id_cv);
    const mes = mesAtual();
    const anterior = mesAnterior(mes);
    const [estoques, vendas] = await Promise.all([lerEstoqueAtual(idsCv), lerVendasMensais(idsCv, anterior)]);
    for (const l of ligados) {
      const est = estoques.find((e) => e.id === l.id_cv);
      const vMes = vendas.find((v) => v.id === l.id_cv && v.mesAno === mes);
      const vAnt = vendas.find((v) => v.id === l.id_cv && v.mesAno === anterior);
      if (est) {
        await db().query(
          `insert into dados_proprios_mensais (id_empreendimento, mes_ano, estoque, vendas, origem, reservadas, bloqueadas,
                                               ticket_tabela_centavos, ticket_desconto_centavos, desconto_pct, atualizado_em)
           values ($1, $2, $3, $4, 'cv', $5, $6, $7, $8, $9, now())
           on conflict (id_empreendimento, mes_ano) do update set
             estoque = excluded.estoque, vendas = excluded.vendas, reservadas = excluded.reservadas,
             bloqueadas = excluded.bloqueadas, ticket_tabela_centavos = excluded.ticket_tabela_centavos,
             ticket_desconto_centavos = excluded.ticket_desconto_centavos, desconto_pct = excluded.desconto_pct,
             atualizado_em = now()
           where dados_proprios_mensais.origem = 'cv'`,
          [l.id_empreendimento, mes, est.disponiveis + est.reservadas, vMes?.vendas ?? 0, est.reservadas, est.bloqueadas,
            est.ticketTabelaCentavos, vMes?.ticketDescontoCentavos ?? null, vMes?.descontoPct ?? null],
        );
      }
      // Mês que fechou: só vendas e ticket com desconto (o estoque é a foto do fechamento).
      await db().query(
        `update dados_proprios_mensais set vendas = $3, ticket_desconto_centavos = $4, desconto_pct = $5, atualizado_em = now()
          where id_empreendimento = $1 and mes_ano = $2 and origem = 'cv'`,
        [l.id_empreendimento, anterior, vAnt?.vendas ?? 0, vAnt?.ticketDescontoCentavos ?? null, vAnt?.descontoPct ?? null],
      );
    }
    r = { ok: true, mensagem: `${ligados.length} empreendimento(s) atualizados com o CV.` };
  } catch (e) {
    console.error("[cv] sincronização:", e);
    r = { ok: false, mensagem: "Não foi possível ler o BI do CV." };
  }
  await db().query(`update cv_sincronizacao set ultima_em = now(), ok = $1, mensagem = $2 where id = 1`, [r.ok, r.mensagem]);
  return r;
}

/** Sincroniza se a última vez foi há mais de `minutos` (usado ao abrir os dashboards). */
export async function sincronizarSeAntigo(minutos = 30): Promise<void> {
  if (!cvConfigurado()) return;
  const { rows: [s] } = await db().query(`select ultima_em from cv_sincronizacao where id = 1`);
  if (s?.ultima_em && Date.now() - new Date(s.ultima_em).getTime() < minutos * 60_000) return;
  await sincronizarSousaCV();
}
