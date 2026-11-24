import { describe, expect, it } from "vitest";
import { classificarPreenchimento, estoqueDoCV, estoqueDoFimDoMes, lerMesPreenchivel, mesSeguinte } from "@/lib/domain/preenchimentoCV";

describe("estoqueDoCV", () => {
  it("soma as bloqueadas ao estoque: 300 disponíveis + 30 bloqueadas = 330", () => {
    expect(estoqueDoCV({ disponiveis: 300, reservadas: 0, bloqueadas: 30 })).toBe(330);
  });
  it("disponíveis + reservadas + bloqueadas", () => {
    expect(estoqueDoCV({ disponiveis: 7, reservadas: 2, bloqueadas: 4 })).toBe(13);
  });
  it("sem bloqueadas continua igual ao de antes", () => {
    expect(estoqueDoCV({ disponiveis: 10, reservadas: 3, bloqueadas: 0 })).toBe(13);
  });
});

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
