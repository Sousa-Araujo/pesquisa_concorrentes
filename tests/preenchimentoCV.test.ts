import { describe, expect, it } from "vitest";
import { classificarPreenchimento, estoqueDoFimDoMes, lerMesPreenchivel, mesSeguinte } from "@/lib/domain/preenchimentoCV";

describe("classificarPreenchimento", () => {
  const cv = { estoque: 60, vendas: 4 };
  it("sem dado no CV", () => expect(classificarPreenchimento(null, null)).toBe("sem_cv"));
  it("mês sem linha no Hub vira novo", () => expect(classificarPreenchimento(null, cv)).toBe("novo"));
  it("linha do CV já existente não é refeita", () =>
    expect(classificarPreenchimento({ origem: "cv", estoque: 1, vendas: 1 }, cv)).toBe("ja_cv"));
  it("linha digitada igual ao CV", () =>
    expect(classificarPreenchimento({ origem: "manual", estoque: 60, vendas: 4 }, cv)).toBe("manual_igual"));
  it("linha digitada diferente do CV só é apontada", () =>
    expect(classificarPreenchimento({ origem: "manual", estoque: 60, vendas: 20 }, cv)).toBe("manual_diverge"));
});

describe("estoqueDoFimDoMes", () => {
  it("soma as vendas feitas depois do mês", () => expect(estoqueDoFimDoMes(100, 13)).toBe(113));
  it("não fica negativo", () => expect(estoqueDoFimDoMes(-3, 0)).toBe(0));
});

describe("lerMesPreenchivel", () => {
  it("aceita mês fechado", () => expect(lerMesPreenchivel("2026-10-01", "2026-11-01")).toBe("2026-10-01"));
  it("recusa o mês atual e os futuros", () => {
    expect(lerMesPreenchivel("2026-11-01", "2026-11-01")).toBeNull();
    expect(lerMesPreenchivel("2026-12-01", "2026-11-01")).toBeNull();
  });
  it("recusa formato inválido, dia diferente de 1 e antes de 2025", () => {
    expect(lerMesPreenchivel("2026-10", "2026-11-01")).toBeNull();
    expect(lerMesPreenchivel("2026-10-15", "2026-11-01")).toBeNull();
    expect(lerMesPreenchivel("2026-13-01", "2026-11-01")).toBeNull();
    expect(lerMesPreenchivel("2024-12-01", "2026-11-01")).toBeNull();
  });
});

describe("mesSeguinte", () => {
  it("avança um mês e vira o ano", () => {
    expect(mesSeguinte("2026-09-01")).toBe("2026-10-01");
    expect(mesSeguinte("2026-12-01")).toBe("2027-01-01");
  });
});
