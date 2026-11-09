import { describe, it, expect } from "vitest";
import { calcularConsolidado } from "../src/lib/domain/consolidado";

/**
 * Mesmos números do exemplo canônico (seção 48), agora agregados em dois
 * lados: Sousa (o item próprio) vs Concorrentes (soma de B, C, D, E).
 * Estoque próprio 100 / vendas 11 ; concorrentes estoque 633 / vendas 59.
 */
const BASE = calcularConsolidado({
  sousaEstoque: 100,
  sousaVendas: 11,
  concEstoque: 187 + 122 + 90 + 234, // 633
  concVendas: 11 + 15 + 11 + 22, // 59
});

describe("Consolidado — agregados", () => {
  it("oferta total = 733 e vendas totais = 70", () => {
    expect(BASE.ofertaTotal).toBe(733);
    expect(BASE.vendasTotais).toBe(70);
  });

  it("representatividades somam 100%", () => {
    expect(BASE.sousa.representatividade + BASE.concorrentes.representatividade)
      .toBeCloseTo(1, 6);
  });

  it("Sousa: representatividade 100/733 e VSO 11/111", () => {
    expect(BASE.sousa.representatividade).toBeCloseTo(0.136426, 5);
    expect(BASE.sousa.vso).toBeCloseTo(0.099099, 5);
  });

  it("Concorrentes: representatividade 633/733 e VSO 59/692", () => {
    expect(BASE.concorrentes.representatividade).toBeCloseTo(0.863574, 5);
    expect(BASE.concorrentes.vso).toBeCloseTo(0.085260, 5);
  });

  it("VSO de mercado = 70/803", () => {
    expect(BASE.vsoMercado).toBeCloseTo(0.087173, 5);
  });
});

describe("Consolidado — bordas", () => {
  it("sem estoque em nenhum lado não divide por zero", () => {
    const r = calcularConsolidado({ sousaEstoque: 0, sousaVendas: 0, concEstoque: 0, concVendas: 0 });
    expect(r.ofertaTotal).toBe(0);
    expect(r.sousa.representatividade).toBe(0);
    expect(r.sousa.vso).toBe(0);
    expect(r.concorrentes.vso).toBe(0);
    expect(r.vsoMercado).toBe(0);
  });

  it("sem dados próprios: lado Sousa zerado, concorrentes com 100% de representatividade", () => {
    const r = calcularConsolidado({ sousaEstoque: 0, sousaVendas: 0, concEstoque: 500, concVendas: 40 });
    expect(r.sousa.representatividade).toBe(0);
    expect(r.sousa.vso).toBe(0);
    expect(r.concorrentes.representatividade).toBeCloseTo(1, 6);
    expect(r.concorrentes.vso).toBeCloseTo(0.074074, 5);
  });
});
