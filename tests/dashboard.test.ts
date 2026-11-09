import { describe, it, expect } from "vitest";
import {
  calcularOfertaTotal,
  calcularVendasTotais,
  calcularRepresentatividade,
  calcularVso,
  calcularDashboard,
  type ItemMercado,
} from "../src/lib/domain/dashboard";

/**
 * Dados do exemplo canônico da especificação (seção 48) e da planilha
 * DASHBOARD_REGRAS. Estoques: 100,187,122,90,234 ; Vendas: 11,11,15,11,22.
 * O primeiro item é o empreendimento próprio.
 */
const ITENS: ItemMercado[] = [
  { rotulo: "Empreendimento próprio", proprio: true,  estoque: 100, vendas: 11 },
  { rotulo: "Concorrente B",          proprio: false, estoque: 187, vendas: 11 },
  { rotulo: "Concorrente C",          proprio: false, estoque: 122, vendas: 15 },
  { rotulo: "Concorrente D",          proprio: false, estoque: 90,  vendas: 11 },
  { rotulo: "Concorrente E",          proprio: false, estoque: 234, vendas: 22 },
];

describe("Oferta / Estoque total (seção 29)", () => {
  it("soma todos os estoques = 733", () => {
    expect(calcularOfertaTotal(ITENS)).toBe(733);
  });
});

describe("Vendas totais (seção 30)", () => {
  it("soma todas as vendas = 70", () => {
    expect(calcularVendasTotais(ITENS)).toBe(70);
  });
});

describe("Representatividade (seção 31)", () => {
  it("100 / 733 ≈ 13,64%", () => {
    expect(calcularRepresentatividade(100, 733)).toBeCloseTo(0.136426, 5);
  });
  it("soma das representatividades ≈ 100%", () => {
    const total = calcularOfertaTotal(ITENS);
    const soma = ITENS.reduce(
      (a, i) => a + calcularRepresentatividade(i.estoque, total),
      0,
    );
    expect(soma).toBeCloseTo(1, 6);
  });
});

describe("VSO individual — vendas ÷ (estoque + vendas)", () => {
  it("11 / (100 + 11) ≈ 9,91%", () => {
    expect(calcularVso(11, 100)).toBeCloseTo(0.099099, 5);
  });
  it("11 / (187 + 11) ≈ 5,56%", () => {
    expect(calcularVso(11, 187)).toBeCloseTo(0.055556, 5);
  });
  it("15 / (122 + 15) ≈ 10,95%", () => {
    expect(calcularVso(15, 122)).toBeCloseTo(0.109489, 5);
  });
  it("11 / (90 + 11) ≈ 10,89%", () => {
    expect(calcularVso(11, 90)).toBeCloseTo(0.108911, 5);
  });
  it("22 / (234 + 22) ≈ 8,59%", () => {
    expect(calcularVso(22, 234)).toBeCloseTo(0.085938, 5);
  });
  it("vendeu tudo (estoque 0) = 100%; sem estoque nem vendas = 0", () => {
    expect(calcularVso(10, 0)).toBe(1);
    expect(calcularVso(0, 0)).toBe(0);
  });
  it("Sou Pleno Home II out/26: 2 / (6 + 2) = 25%", () => {
    expect(calcularVso(2, 6)).toBe(0.25);
  });
});

describe("Ranking de VSO (seção 33 e 48)", () => {
  const { itens } = calcularDashboard(ITENS);
  const pos = (r: string) => itens.find((i) => i.rotulo === r)!.rankingVso;

  it("15/122 (C) -> 1º", () => expect(pos("Concorrente C")).toBe(1));
  it("11/90 (D) -> 2º",  () => expect(pos("Concorrente D")).toBe(2));
  it("11/100 (próprio) -> 3º", () => expect(pos("Empreendimento próprio")).toBe(3));
  it("22/234 (E) -> 4º", () => expect(pos("Concorrente E")).toBe(4));
  it("11/187 (B) -> 5º", () => expect(pos("Concorrente B")).toBe(5));
});

describe("Métricas proibidas (seção 34)", () => {
  it("não existe função/constante para 15,71% ou 1,50%", async () => {
    const mod = await import("../src/lib/domain/dashboard");
    const nomes = Object.keys(mod).join(" ").toLowerCase();
    expect(nomes).not.toContain("consolidado");
    expect(nomes).not.toContain("1571");
    expect(nomes).not.toContain("150");
  });
});

describe("Empates no ranking recebem a mesma posição", () => {
  it("dois itens com mesmo VSO compartilham posição", () => {
    const empate: ItemMercado[] = [
      { rotulo: "X", proprio: false, estoque: 100, vendas: 10 }, // 10%
      { rotulo: "Y", proprio: false, estoque: 200, vendas: 20 }, // 10%
      { rotulo: "Z", proprio: false, estoque: 100, vendas: 5 },  // 5%
    ];
    const { itens } = calcularDashboard(empate);
    const p = (r: string) => itens.find((i) => i.rotulo === r)!.rankingVso;
    expect(p("X")).toBe(1);
    expect(p("Y")).toBe(1);
    expect(p("Z")).toBe(3);
  });
});
