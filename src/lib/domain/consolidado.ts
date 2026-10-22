/**
 * Visão consolidada — Sousa Araújo vs Concorrentes.
 *
 * Diferente do dashboard por empreendimento (dashboard.ts), aqui não há
 * ranking nem lista de itens: somam-se os números do lado próprio (todos os
 * empreendimentos da empresa no escopo) contra a soma dos concorrentes,
 * numa única competência.
 *
 * As fórmulas são as MESMAS já confirmadas na especificação (seções 29–32),
 * apenas aplicadas a dois agregados:
 *   - Estoque / Oferta        = soma dos estoques (seção 29)
 *   - Vendas                   = soma das vendas   (seção 30)
 *   - Representatividade       = estoque_lado / oferta_total (seção 31)
 *   - VSO                      = vendas_lado / (estoque_lado + vendas_lado)
 *
 * Isto NÃO é o "VSO consolidado de 15,71%" da seção 34 (regra desconhecida,
 * proibida): é uma agregação transparente pedida pela gestão para comparar a
 * rede própria com o mercado concorrente.
 */
import { calcularRepresentatividade, calcularVso } from "./dashboard";

export interface EntradaConsolidado {
  /** Soma do estoque próprio (DADOS_PROPRIOS_MENSAIS) no escopo/competência. */
  sousaEstoque: number;
  /** Soma das vendas próprias no escopo/competência. */
  sousaVendas: number;
  /** Soma do estoque dos concorrentes (COLETAS_MENSAIS) no escopo/competência. */
  concEstoque: number;
  /** Soma das vendas dos concorrentes no escopo/competência. */
  concVendas: number;
}

export interface LadoConsolidado {
  estoque: number;
  vendas: number;
  /** Fração 0..1 do estoque total (próprio + concorrentes). */
  representatividade: number;
  /** Fração 0..1: vendas / (estoque + vendas) do próprio lado; 0 sem estoque nem vendas. */
  vso: number;
}

export interface ResultadoConsolidado {
  sousa: LadoConsolidado;
  concorrentes: LadoConsolidado;
  /** Oferta = estoque próprio + estoque concorrentes. */
  ofertaTotal: number;
  /** Vendas totais = vendas próprias + vendas concorrentes. */
  vendasTotais: number;
  /** VSO de mercado = vendas totais / (oferta total + vendas totais). */
  vsoMercado: number;
}

export function calcularConsolidado(e: EntradaConsolidado): ResultadoConsolidado {
  const ofertaTotal = e.sousaEstoque + e.concEstoque;
  const vendasTotais = e.sousaVendas + e.concVendas;

  return {
    sousa: {
      estoque: e.sousaEstoque,
      vendas: e.sousaVendas,
      representatividade: calcularRepresentatividade(e.sousaEstoque, ofertaTotal),
      vso: calcularVso(e.sousaVendas, e.sousaEstoque),
    },
    concorrentes: {
      estoque: e.concEstoque,
      vendas: e.concVendas,
      representatividade: calcularRepresentatividade(e.concEstoque, ofertaTotal),
      vso: calcularVso(e.concVendas, e.concEstoque),
    },
    ofertaTotal,
    vendasTotais,
    vsoMercado: calcularVso(vendasTotais, ofertaTotal),
  };
}
