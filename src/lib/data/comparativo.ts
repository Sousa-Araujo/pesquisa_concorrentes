/**
 * Dados do Comparativo Sousa x concorrentes (dashboard da Diretoria), para
 * um empreendimento Sousa e uma competência:
 *  - preço, entrada, fluxo, área e entrega: da visita do Cliente Oculto
 *    concluída mais recente até o fim da competência;
 *  - estoque e vendas: dados próprios (vindos do BI do CV ou digitados) e
 *    coletas da Pesquisa no mês;
 *  - Sousa com dados do CV: ticket de tabela do estoque e ticket com desconto
 *    (valor de contrato) das vendas do mês substituem os preços da visita;
 *  - atendimento: nota geral calibrada da mesma visita.
 * Visitas antigas, de antes da ligação com o cadastro, são reconhecidas pelo
 * nome do empreendimento/concorrente.
 */
import { db } from "@/lib/db/pool";
import {
  calcularGiro, calcularPreco, lerEntrega, lerParcelas, mesesAteEntrega, nomeComparavel, resumoAtendimento,
  rotuloEntrega, type Giro, type Preco,
} from "@/lib/domain/comparativo";

export interface ColunaComparativo {
  nome: string;
  construtora: string | null;
  proprio: boolean;
  visita: { id: string; data: string | null } | null;
  preco: Preco;
  parcelasPre: number | null;
  parcelasPos: number | null;
  prazoEntregaMeses: number | null;
  entrega: string | null;
  areaM2: number | null;
  estoque: number | null;
  vendas: number | null;
  vso: number | null;
  mesesZerar: number | null;
  giro: Giro;
  notaGeral: number | null;
  resumo: string | null;
}

export interface Comparativo {
  empreendimento: string;
  colunas: ColunaComparativo[];
}

const GRAVIDADE = { critica: 4, alta: 3, moderada: 2, baixa: 1 } as Record<string, number>;

export async function montarComparativo(idEmpreendimento: number, mesAno: string): Promise<Comparativo | null> {
  const pool = db();
  const { rows: [emp] } = await pool.query<{ empreendimento: string }>(
    `select empreendimento from empreendimentos where id_empreendimento = $1`, [idEmpreendimento],
  );
  if (!emp) return null;

  const [{ rows: concorrentes }, { rows: [proprio] }, { rows: coletas }, { rows: visitas }] = await Promise.all([
    pool.query<{ id_concorrente: number; concorrente: string }>(
      `select id_concorrente, concorrente from concorrentes
        where id_empreendimento = $1 and ativo order by concorrente`, [idEmpreendimento]),
    pool.query<{ estoque: number; vendas: number; ticket_tabela_centavos: string | null; ticket_desconto_centavos: string | null }>(
      `select estoque, vendas, ticket_tabela_centavos, ticket_desconto_centavos
         from dados_proprios_mensais where id_empreendimento = $1 and mes_ano = $2`,
      [idEmpreendimento, mesAno]),
    pool.query<{ id_concorrente: number; estoque: number; vendas: number }>(
      `select cm.id_concorrente, cm.estoque, cm.vendas from coletas_mensais cm
         join concorrentes c on c.id_concorrente = cm.id_concorrente
        where c.id_empreendimento = $1 and cm.mes_ano = $2`, [idEmpreendimento, mesAno]),
    // Visitas concluídas até o fim da competência, a mais recente primeiro.
    pool.query(
      `select id, tipo_empreendimento, id_empreendimento, id_concorrente, empreendimento_texto, construtora_texto,
              to_char(data_visita, 'YYYY-MM-DD') as data_visita, valor_unidade_centavos, valor_ato_centavos,
              desconto_tipo, desconto_valor_centavos, desconto_percentual, area_unidade_m2,
              qtd_pre_chaves, qtd_pos_chaves, previsao_entrega
         from co_avaliacoes
        where status = 'Concluída' and not excluida and not coalesce(somente_previa, false)
          and (data_visita is null or data_visita < ($1::date + interval '1 month'))
        order by data_visita desc nulls last, concluida_em desc`, [mesAno]),
  ]);

  const nomeEmp = nomeComparavel(emp.empreendimento);
  const visitaSousa = visitas.find((v) => v.tipo_empreendimento === "sousa"
    && (v.id_empreendimento === idEmpreendimento || (!v.id_empreendimento && nomeComparavel(v.empreendimento_texto) === nomeEmp)));
  const visitaDe = (c: { id_concorrente: number; concorrente: string }) => visitas.find((v) => v.tipo_empreendimento === "concorrente"
    && (v.id_concorrente === c.id_concorrente || (!v.id_concorrente && nomeComparavel(v.empreendimento_texto) === nomeComparavel(c.concorrente))));

  const usadas = [visitaSousa, ...concorrentes.map(visitaDe)].filter(Boolean).map((v) => v!.id as string);
  const { rows: pilares } = usadas.length
    ? await pool.query(`select avaliacao_id, pilar_key, avaliado, nota_calibrada from co_pilares where avaliacao_id = any($1)`, [usadas])
    : { rows: [] as Record<string, unknown>[] };
  const { rows: gaps } = usadas.length
    ? await pool.query(`select avaliacao_id, gap, gravidade from co_gaps where avaliacao_id = any($1)`, [usadas])
    : { rows: [] as Record<string, unknown>[] };

  function coluna(
    nome: string, proprio: boolean, v: Record<string, unknown> | undefined, estoque: number | null, vendas: number | null,
    precoCV?: { tabela: number | null; desconto: number | null },
  ): ColunaComparativo {
    let preco = calcularPreco({
      valorTabelaCentavos: v?.valor_unidade_centavos ? Number(v.valor_unidade_centavos) : null,
      descontoTipo: (v?.desconto_tipo as "valor" | "percentual" | null) ?? null,
      descontoValorCentavos: v?.desconto_valor_centavos ? Number(v.desconto_valor_centavos) : null,
      descontoPercentual: v?.desconto_percentual !== null && v?.desconto_percentual !== undefined ? Number(v.desconto_percentual) : null,
      valorAtoCentavos: v?.valor_ato_centavos ? Number(v.valor_ato_centavos) : null,
      areaM2: v?.area_unidade_m2 ? Number(v.area_unidade_m2) : null,
    });
    if (precoCV && (precoCV.tabela || precoCV.desconto)) {
      // Preços do CV (em reais): tabela do estoque e ticket líquido das vendas do mês.
      const tabela = precoCV.tabela ?? preco.valorTabela;
      const liquido = precoCV.desconto ?? tabela;
      const area = v?.area_unidade_m2 ? Number(v.area_unidade_m2) : null;
      const desconto = tabela !== null && liquido !== null && tabela > liquido ? tabela - liquido : null;
      preco = {
        ...preco,
        valorTabela: tabela,
        ticketLiquido: liquido,
        porM2: liquido !== null && area ? liquido / area : null,
        descontoReais: desconto,
        descontoPct: desconto !== null && tabela ? desconto / tabela : null,
        atoPct: preco.ato !== null && liquido ? preco.ato / liquido : preco.atoPct,
      };
    }
    const entrega = lerEntrega(v?.previsao_entrega as string | null);
    const giro = calcularGiro(estoque, vendas);
    const meus = v ? pilares.filter((p) => p.avaliacao_id === v.id && p.avaliado) : [];
    const notas = meus.map((p) => (p.nota_calibrada === null ? null : Number(p.nota_calibrada)));
    const validas = notas.filter((n): n is number => n !== null);
    const gap = v ? gaps.filter((g) => g.avaliacao_id === v.id)
      .sort((a, b) => (GRAVIDADE[String(b.gravidade)] ?? 0) - (GRAVIDADE[String(a.gravidade)] ?? 0))[0] : undefined;
    return {
      nome,
      construtora: (v?.construtora_texto as string | null) ?? null,
      proprio,
      visita: v ? { id: String(v.id), data: (v.data_visita as string | null) ?? null } : null,
      preco,
      parcelasPre: lerParcelas(v?.qtd_pre_chaves as string | null),
      parcelasPos: lerParcelas(v?.qtd_pos_chaves as string | null),
      prazoEntregaMeses: mesesAteEntrega(mesAno, entrega),
      entrega: rotuloEntrega(entrega),
      areaM2: v?.area_unidade_m2 ? Number(v.area_unidade_m2) : null,
      estoque,
      vendas,
      vso: giro.vso,
      mesesZerar: giro.mesesZerar,
      giro: giro.giro,
      notaGeral: validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : null,
      resumo: v && validas.length
        ? resumoAtendimento(meus.map((p) => ({ key: String(p.pilar_key), nota: p.nota_calibrada === null ? null : Number(p.nota_calibrada) })),
          gap ? String(gap.gap) : null)
        : null,
    };
  }

  const colunas = [
    coluna(emp.empreendimento, true, visitaSousa, proprio?.estoque ?? null, proprio?.vendas ?? null, {
      tabela: proprio?.ticket_tabela_centavos ? Number(proprio.ticket_tabela_centavos) / 100 : null,
      desconto: proprio?.ticket_desconto_centavos ? Number(proprio.ticket_desconto_centavos) / 100 : null,
    }),
    ...concorrentes.map((c) => {
      const col = coletas.find((x) => x.id_concorrente === c.id_concorrente);
      return coluna(c.concorrente, false, visitaDe(c), col?.estoque ?? null, col?.vendas ?? null);
    }),
  ];
  return { empreendimento: emp.empreendimento, colunas };
}
