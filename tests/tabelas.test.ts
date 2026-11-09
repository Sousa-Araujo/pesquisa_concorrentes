import { describe, expect, it } from "vitest";
import { normalizarUnidades, resumirUnidades, type Unidade } from "@/lib/domain/tabelas";

const u = (unidade: string, status: Unidade["status"], reais: number | null = null): Unidade =>
  ({ unidade, status, valorCentavos: reais === null ? null : reais * 100 });

describe("resumirUnidades", () => {
  const atual = [
    u("121 NYC", "vendida", 359400), u("122 NYC", "reservada", 359400), u("123 NYC", "vendida", 359400),
    u("111 NYC", "disponivel", 368400), u("112 NYC", "disponivel", 368400), u("101 NYC", "disponivel", 367400),
  ];

  it("reservadas contam no estoque; preços só das disponíveis", () => {
    const r = resumirUnidades(atual, null, null);
    expect(r.estoque).toBe(4);
    expect(r.reservadas).toBe(1);
    expect(r.vendidasTotal).toBe(2);
    expect(r.valorMax).toBe(36840000);
    expect(r.valorMin).toBe(36740000);
    expect(r.unidadeMin).toBe("101 NYC");
    expect(r.ticketMedio).toBe(Math.round((36840000 * 2 + 36740000) / 3));
    expect(r.vendasMes).toBeNull();
  });

  it("vendas do mês pelas unidades que viraram vendidas desde a última leitura", () => {
    const antes = [u("121 NYC", "vendida"), u("122 NYC", "disponivel"), u("123 NYC", "disponivel"), u("111 NYC", "disponivel")];
    const r = resumirUnidades(atual, { unidades: antes }, 99);
    expect(r.vendasMes).toBe(1);
    expect(r.vendasMetodo).toBe("unidades");
  });

  it("sem leitura anterior, usa o estoque do mês anterior", () => {
    const r = resumirUnidades(atual, null, 7);
    expect(r.vendasMes).toBe(3);
    expect(r.vendasMetodo).toBe("estoque");
  });
});

describe("valor com desconto", () => {
  it("calcula maior, menor e ticket também para o valor com desconto", () => {
    const us: Unidade[] = [
      { unidade: "11", status: "disponivel", valorCentavos: 37440000, valorDescontoCentavos: 34640000 },
      { unidade: "21", status: "disponivel", valorCentavos: 37440000, valorDescontoCentavos: 34740000 },
      { unidade: "93", status: "reservada", valorCentavos: 37440000, valorDescontoCentavos: 30000000 },
    ];
    const r = resumirUnidades(us, null, null);
    expect(r.ticketMedio).toBe(37440000);
    expect(r.descontoMin).toBe(34640000);
    expect(r.descontoMax).toBe(34740000);
    expect(r.ticketDesconto).toBe(34690000);
  });

  it("sem valor com desconto, os campos ficam vazios", () => {
    const r = resumirUnidades([u("1", "disponivel", 300000)], null, null);
    expect(r.ticketDesconto).toBeNull();
    expect(r.descontoMin).toBeNull();
  });
});

describe("normalizarUnidades", () => {
  it("converte reais em centavos e trata status desconhecido", () => {
    const r = normalizarUnidades([
      { unidade: " 101 ", valor: 367400, status: "disponivel" },
      { unidade: "102", valor: null, status: "permuta", status_original: "Permuta" },
      { unidade: "", status: "vendida" },
    ]);
    expect(r).toEqual([
      { unidade: "101", valorCentavos: 36740000, valorDescontoCentavos: null, status: "disponivel", statusOriginal: undefined },
      { unidade: "102", valorCentavos: null, valorDescontoCentavos: null, status: "outro", statusOriginal: "Permuta" },
    ]);
  });

  it("separa valor de tabela e com desconto; só um valor vira o de tabela", () => {
    const r = normalizarUnidades([
      { unidade: "11", valor_tabela: 374400, valor_desconto: 346400, status: "disponivel" },
      { unidade: "12", valor_tabela: null, valor_desconto: 346400, status: "disponivel" },
      { unidade: "13", valor_tabela: 374400, valor_desconto: 374400, status: "disponivel" },
    ]);
    expect(r.map((x) => [x.valorCentavos, x.valorDescontoCentavos])).toEqual([
      [37440000, 34640000], [34640000, null], [37440000, null],
    ]);
  });
});
