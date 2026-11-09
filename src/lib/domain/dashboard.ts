/**
 * Cálculos do Dashboard — seções 28 a 34 da especificação.
 *
 * Métricas IMPLEMENTADAS (as únicas confirmadas):
 *   - Oferta / Estoque total  (seção 29)
 *   - Vendas totais           (seção 30)
 *   - Representatividade       (seção 31)
 *   - VSO individual           (seção 32)
 *   - Ranking de VSO           (seção 33)
 *
 * Métricas EXPLICITAMENTE NÃO implementadas (seção 34 + planilha):
 *   - "VSO consolidado" de 15,71%  -> regra não confirmada
 *   - indicador de 1,50%           -> regra não confirmada
 * Não inventar KPIs. Se a regra for confirmada no futuro, adicionar aqui.
 */

/** Um item comparável do dashboard: o empreendimento próprio ou um concorrente. */
export interface ItemMercado {
  /** Identificador de exibição (ex.: "SOU PLENO HOME II" ou "Mirage Mogi Moderno"). */
  rotulo: string;
  /** true quando é o empreendimento próprio da incorporadora. */
  proprio: boolean;
  estoque: number;
  vendas: number;
}

export interface ItemCalculado extends ItemMercado {
  /** estoque_item / estoque_total (fração 0..1). */
  representatividade: number;
  /** vendas_item / estoque_item (fração 0..1); 0 quando estoque = 0. */
  vso: number;
  /** posição no ranking de VSO (1 = melhor). */
  rankingVso: number;
}

export interface ResultadoDashboard {
  itens: ItemCalculado[];
  /** Oferta = soma de todos os estoques (próprio + concorrentes). */
  ofertaTotal: number;
  /** Soma de todas as vendas (próprio + concorrentes). */
  vendasTotais: number;
}

/** Oferta / Estoque total — seção 29. */
export function calcularOfertaTotal(itens: ItemMercado[]): number {
  return itens.reduce((acc, i) => acc + i.estoque, 0);
}

/** Vendas totais — seção 30. */
export function calcularVendasTotais(itens: ItemMercado[]): number {
  return itens.reduce((acc, i) => acc + i.vendas, 0);
}

/** Representatividade de um item — seção 31. Fração 0..1. */
export function calcularRepresentatividade(estoqueItem: number, estoqueTotal: number): number {
  if (estoqueTotal <= 0) return 0;
  return estoqueItem / estoqueTotal;
}

/**
 * VSO — regra da Diretoria (confirmada em 2026-10-22): vendas do mês ÷
 * (estoque no fim do mês + vendas do mês), ou seja, sobre o que estava à
 * venda no começo do mês. Fração 0..1; 0 quando não há estoque nem vendas.
 * É a mesma regra do comparativo (calcularGiro em comparativo.ts).
 */
export function calcularVso(vendas: number, estoque: number): number {
  const base = estoque + vendas;
  if (base <= 0) return 0;
  return vendas / base;
}

/**
 * Monta o resultado completo do dashboard para um empreendimento numa
 * competência: representatividade, VSO e ranking de VSO por item.
 *
 * Ranking (seção 33): VSO decrescente; empates recebem a MESMA posição
 * (ranking padrão "1,2,2,4"), critério determinístico e estável.
 */
export function calcularDashboard(itens: ItemMercado[]): ResultadoDashboard {
  const ofertaTotal = calcularOfertaTotal(itens);
  const vendasTotais = calcularVendasTotais(itens);

  // Pré-cálculo de representatividade e VSO.
  const base = itens.map((i) => ({
    ...i,
    representatividade: calcularRepresentatividade(i.estoque, ofertaTotal),
    vso: calcularVso(i.vendas, i.estoque),
  }));

  // Ordena por VSO desc para atribuir ranking; empate = mesma posição.
  // Desempate determinístico secundário por rótulo para estabilidade.
  const ordenados = [...base].sort((a, b) => {
    if (b.vso !== a.vso) return b.vso - a.vso;
    return a.rotulo.localeCompare(b.rotulo, "pt-BR");
  });

  const posicaoPorRotulo = new Map<string, number>();
  let posicao = 0;
  let anteriorVso: number | null = null;
  ordenados.forEach((item, idx) => {
    if (anteriorVso === null || item.vso !== anteriorVso) {
      posicao = idx + 1; // ranking padrão: pula posições após empates
      anteriorVso = item.vso;
    }
    posicaoPorRotulo.set(item.rotulo, posicao);
  });

  const itensCalculados: ItemCalculado[] = base.map((i) => ({
    ...i,
    rankingVso: posicaoPorRotulo.get(i.rotulo)!,
  }));

  return { itens: itensCalculados, ofertaTotal, vendasTotais };
}

/** Formata uma fração 0..1 como percentual pt-BR com 2 casas: 0.1364 -> "13,64%". */
export function formatarPercentual(fracao: number): string {
  return (fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + "%";
}
