import { describe, expect, it } from "vitest";
import {
  calcularGiro, calcularPreco, lerEntrega, lerParcelas, melhores, mesesAteEntrega, nomeComparavel, resumoAtendimento,
} from "@/lib/domain/comparativo";

describe("lerEntrega", () => {
  it("entende os formatos escritos à mão", () => {
    expect(lerEntrega("Jun/2027")).toEqual({ ano: 2027, mes: 6 });
    expect(lerEntrega("dez/27")).toEqual({ ano: 2027, mes: 12 });
    expect(lerEntrega("Março de 2029")).toEqual({ ano: 2029, mes: 3 });
    expect(lerEntrega("06/2027")).toEqual({ ano: 2027, mes: 6 });
    expect(lerEntrega("2029-10")).toEqual({ ano: 2029, mes: 10 });
    expect(lerEntrega("pronto")).toBeNull();
  });
  it("conta os meses a partir da competência", () => {
    expect(mesesAteEntrega("2026-10-01", { ano: 2027, mes: 6 })).toBe(8);
    expect(mesesAteEntrega("2026-10-01", { ano: 2026, mes: 5 })).toBe(0);
  });
});

describe("calcularPreco", () => {
  it("ticket líquido, R$/m² e ato sobre o líquido", () => {
    const p = calcularPreco({
      valorTabelaCentavos: 32500000, descontoTipo: "valor", descontoValorCentavos: 3900000, descontoPercentual: null,
      valorAtoCentavos: 500000, areaM2: 52,
    });
    expect(p.ticketLiquido).toBe(286000);
    expect(p.porM2).toBe(5500);
    expect(p.descontoPct).toBeCloseTo(0.12, 4);
    expect(p.atoPct).toBeCloseTo(0.0175, 4);
  });
  it("desconto em percentual", () => {
    const p = calcularPreco({
      valorTabelaCentavos: 20000000, descontoTipo: "percentual", descontoValorCentavos: null, descontoPercentual: 5,
      valorAtoCentavos: null, areaM2: null,
    });
    expect(p.descontoReais).toBe(10000);
    expect(p.ticketLiquido).toBe(190000);
    expect(p.porM2).toBeNull();
  });
});

describe("giro e destaques", () => {
  it("VSO, meses para zerar e classificação", () => {
    const sousa = calcularGiro(10, 4); // modelo: Sou Viver Taubaté
    expect(sousa.vso).toBeCloseTo(0.286, 3);
    expect(sousa.mesesZerar).toBe(2.5);
    expect(sousa.giro).toBe("alto");
    const altiz = calcularGiro(134, 9); // modelo: Altiz 6,3% e ~14,9 meses
    expect(altiz.vso).toBeCloseTo(0.063, 3);
    expect(altiz.mesesZerar).toBeCloseTo(14.9, 1);
    expect(altiz.giro).toBe("lento");
    expect(calcularGiro(36, 0)).toEqual({ vso: 0, mesesZerar: null, giro: "sem_vendas" });
    expect(calcularGiro(62, null).giro).toBe("sem_dados");
  });
  it("destaca o melhor valor ignorando vazios", () => {
    expect([...melhores([255900, 286000, 199000, null], "menor")]).toEqual([2]);
    expect([...melhores([8, 8, 3], "maior")]).toEqual([0, 1]);
    expect(melhores([5, null], "menor").size).toBe(0);
  });
  it("parcelas e nomes", () => {
    expect(lerParcelas("36x")).toBe(36);
    expect(lerParcelas("")).toBeNull();
    expect(nomeComparavel("  SOU  Viver Taubaté ")).toBe("sou viver taubate");
  });
  it("resumo do atendimento", () => {
    const r = resumoAtendimento([{ key: "pdv", nota: 9 }, { key: "materiais", nota: 6 }, { key: "recepcao", nota: null }], "Sem maquete");
    expect(r).toBe("Fortes: PDV (9,0). Fracos: Marketing (6,0). Principal gap: Sem maquete");
  });
});
