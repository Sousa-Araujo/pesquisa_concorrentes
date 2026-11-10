import { describe, it, expect } from "vitest";
import { temPermissao } from "../src/lib/auth/perfis";
import {
  aplicarComite, chaveEmpreendimento, empreendimentosRepetidos, entregaComoData, lerPercentualOuTexto, ligarEmpreendimento,
  ligarLinhas, linhaVazia, normalizarLinhasIA, prazoAteEntrega, problemasDaLinha, sanearLinhas, type CondicaoComite,
} from "../src/lib/domain/comite";

// Linhas reais do "Comitê de Vendas 2026 - Julho (GERAL)", como a IA as devolve.
const IA_JULHO = [
  { regional: "RVP", produto: "SOU VIVER TAUBATÉ M2", previsao_entrega: "junho/27", ato_parcelas: 12, presoluto_parcelas: 48, presoluto_percentual: "12%",
    desconto_financiado: "Qualquer unidade a R$ 251.900,00, até dia 15/07, limitado a 04 vendas", desconto_avista: "20%" },
  { regional: "RVP", produto: "SOU VIVER VERONA", previsao_entrega: "maio/28", ato_parcelas: 23, presoluto_parcelas: 30, presoluto_percentual: "10%",
    desconto_financiado: "6,00%", desconto_avista: "20%" },
  { regional: "RGC", produto: "SAFIRA M2", previsao_entrega: "dezembro/27", ato_parcelas: 18, presoluto_parcelas: 30, presoluto_percentual: "10%",
    desconto_financiado: "6,50%", desconto_avista: "22%" },
  { regional: "RSP", produto: "SOU VIVER MILÃO", previsao_entrega: "agosto/29", ato_parcelas: 38, presoluto_parcelas: 24, presoluto_percentual: "7%",
    desconto_financiado: "4,00%", desconto_avista: "20%" },
  { regional: "", produto: "TOTAIS", previsao_entrega: null, ato_parcelas: null, presoluto_parcelas: null, presoluto_percentual: null, desconto_financiado: null, desconto_avista: null },
];

describe("lerPercentualOuTexto", () => {
  it("lê percentuais com vírgula, ponto, espaço e sinal de %", () => {
    expect(lerPercentualOuTexto("7,50%")).toEqual({ pct: 7.5, obs: "" });
    expect(lerPercentualOuTexto(" 20 % ")).toEqual({ pct: 20, obs: "" });
    expect(lerPercentualOuTexto("0,3")).toEqual({ pct: 0.3, obs: "" });
    expect(lerPercentualOuTexto(12)).toEqual({ pct: 12, obs: "" });
  });
  it("guarda como observação o que não é percentual (exceção em texto)", () => {
    const t = "Qualquer unidade a R$ 293.900,00";
    expect(lerPercentualOuTexto(t)).toEqual({ pct: null, obs: t });
    expect(lerPercentualOuTexto("150%")).toEqual({ pct: null, obs: "150%" });
  });
  it("vazio não é nada", () => {
    expect(lerPercentualOuTexto("")).toEqual({ pct: null, obs: "" });
    expect(lerPercentualOuTexto(null)).toEqual({ pct: null, obs: "" });
  });
});

describe("normalizarLinhasIA", () => {
  const linhas = normalizarLinhasIA(IA_JULHO);
  it("descarta a linha de totais e mantém os produtos", () => {
    expect(linhas.map((l) => l.produto)).toEqual(["SOU VIVER TAUBATÉ M2", "SOU VIVER VERONA", "SAFIRA M2", "SOU VIVER MILÃO"]);
  });
  it("converte os campos do Quadro Comparativo", () => {
    expect(linhas[1]).toMatchObject({
      regional: "RVP", previsaoEntrega: "maio/28", parcelasPre: 23, parcelasPos: 30, posPercentual: 10,
      descontoFinanciado: 6, descontoFinanciadoObs: "", descontoAvista: 20,
    });
  });
  it("desconto em texto vira observação, sem percentual", () => {
    expect(linhas[0].descontoFinanciado).toBeNull();
    expect(linhas[0].descontoFinanciadoObs).toMatch(/^Qualquer unidade a R\$ 251\.900,00/);
    expect(linhas[0].descontoAvista).toBe(20);
  });
  it("ignora lixo", () => {
    expect(normalizarLinhasIA(null)).toEqual([]);
    expect(normalizarLinhasIA([1, "a", null, { produto: "" }])).toEqual([]);
  });
});

describe("entrega e prazo", () => {
  it("converte a previsão escrita no PDF", () => {
    expect(entregaComoData("junho/27")).toBe("2027-06-01");
    expect(entregaComoData("março/29")).toBe("2029-03-01");
    expect(entregaComoData("sem data")).toBeNull();
  });
  it("prazo = meses da competência até a entrega", () => {
    expect(prazoAteEntrega("junho/27", "2026-07-01")).toBe(11);
    expect(prazoAteEntrega("dezembro/26", "2026-07-01")).toBe(5);
    expect(prazoAteEntrega("junho/26", "2026-07-01")).toBe(0);
    expect(prazoAteEntrega("", "2026-07-01")).toBeNull();
  });
});

describe("ligação com o cadastro", () => {
  const cadastro = [
    { id: 1, nome: "Residencial Sou Viver Taubaté II" },
    { id: 2, nome: "Sou Viver Verona" },
    { id: 3, nome: "Residencial Safira II" },
    { id: 4, nome: "Residencial Safira I" },
    { id: 5, nome: "Sou Viver Diadema I" },
    { id: 6, nome: "Condomínio Sou Viver Diadema I" },
  ];
  it("a chave troca M2/2 por romano e tira prefixos", () => {
    expect(chaveEmpreendimento("SOU VIVER TAUBATÉ M2")).toBe("sou viver taubate ii");
    expect(chaveEmpreendimento("Residencial Safira II")).toBe("safira ii");
    expect(chaveEmpreendimento("Safira 2")).toBe("safira ii");
    expect(chaveEmpreendimento("GUAIANASES")).toBe("guaianases");
  });
  it("liga pelo nome mesmo com M2 x II e sem o prefixo", () => {
    const sem = new Map<string, number>();
    expect(ligarEmpreendimento("SOU VIVER TAUBATÉ M2", cadastro, sem)).toBe(1);
    expect(ligarEmpreendimento("SOU VIVER VERONA", cadastro, sem)).toBe(2);
    expect(ligarEmpreendimento("SAFIRA M2", cadastro, sem)).toBe(3);
    expect(ligarEmpreendimento("SAFIRA M1", cadastro, sem)).toBe(4);
  });
  it("não adivinha quando há mais de um candidato nem quando não há nenhum", () => {
    const sem = new Map<string, number>();
    expect(ligarEmpreendimento("SOU VIVER DIADEMA M1", cadastro, sem)).toBeNull();
    expect(ligarEmpreendimento("PAISAGE M1", cadastro, sem)).toBeNull();
  });
  it("o apelido aprendido vale e resolve o caso ambíguo", () => {
    const aprendido = new Map([[chaveEmpreendimento("SOU VIVER DIADEMA M1"), 6]]);
    expect(ligarEmpreendimento("SOU VIVER DIADEMA M1", cadastro, aprendido)).toBe(6);
  });
  it("apelido de empreendimento que saiu do cadastro é ignorado", () => {
    const aprendido = new Map([[chaveEmpreendimento("SAFIRA M2"), 99]]);
    expect(ligarEmpreendimento("SAFIRA M2", cadastro, aprendido)).toBe(3);
  });
  it("ligarLinhas não mexe no que a pessoa já escolheu", () => {
    const [a, b] = normalizarLinhasIA(IA_JULHO);
    const r = ligarLinhas([{ ...a, idEmpreendimento: 6 }, b], cadastro, new Map());
    expect(r.map((l) => l.idEmpreendimento)).toEqual([6, 2]);
  });
});

describe("ligação com os nomes reais do cadastro", () => {
  // Nomes do cadastro (seed) x produtos do PDF de julho.
  const cadastro = [
    [30, "SOU VIVER TAUBATÉ"], [37, "RESIDENCIAL SAFIRA II"], [51, "SOU VIVER VERONA"], [52, "SOU VIVER DIADEMA"], [54, "SOU MAIS GUAIANASES"],
    [60, "SOU PLENO HOME II"], [63, "SOU MAIS DIADEMA"], [66, "SOU VIVER ITATIBA II"], [67, "SOU VIVER RAVENNA II"],
    [70, "SOU VIVER SOROCABA"], [71, "SOU VIVER UP"], [76, "SOU VIVER NOVA ODESSA II"],
  ].map(([id, nome]) => ({ id: id as number, nome: nome as string }));
  const pdf = (produtos: string[]) => ligarLinhas(
    produtos.map((produto) => ({ ...linhaVazia(), produto })), cadastro, new Map(),
  ).map((l) => l.idEmpreendimento);

  it("liga o que bate pelo nome, pela etapa em romano e pelo nome sem etapa", () => {
    expect(pdf(["SOU VIVER VERONA", "SAFIRA M2", "SOU PLENO HOME M2", "SOU VIVER ITATIBA M2", "SOU VIVER RAVENNA M2", "SOU MAIS DIADEMA"]))
      .toEqual([51, 37, 60, 66, 67, 63]);
    expect(pdf(["SOU VIVER SOROCABA M1", "SOU VIVER UP M1", "SOU VIVER TAUBATÉ M2", "GUAIANASES"])).toEqual([70, 71, 30, 54]);
  });
  it("não liga quando a etapa é outra (SAFIRA M1 x Safira II)", () => {
    expect(pdf(["SAFIRA M1", "SOU VIVER ITATIBA M1", "SOU VIVER NOVA ODESSA M1"])).toEqual([null, null, null]);
  });
  it("duas linhas pedindo o mesmo empreendimento (Diadema M1 e M2): nenhuma é ligada sozinha", () => {
    expect(pdf(["SOU VIVER DIADEMA M1", "SOU VIVER DIADEMA M2"])).toEqual([null, null]);
  });
  it("produto que não existe no cadastro fica sem ligação", () => {
    expect(pdf(["PAISAGE M1", "ALTOS DE SÃO JOSÉ"])).toEqual([null, null]);
  });
});

describe("conferência", () => {
  const ok = { ...normalizarLinhasIA(IA_JULHO)[1], idEmpreendimento: 2 };
  it("linha completa não tem pendência", () => {
    expect(problemasDaLinha(ok)).toEqual([]);
  });
  it("aponta o que falta", () => {
    expect(problemasDaLinha({ ...ok, idEmpreendimento: null })).toHaveLength(1);
    expect(problemasDaLinha({ ...ok, previsaoEntrega: "breve" })[0]).toMatch(/entrega/i);
    expect(problemasDaLinha({ ...ok, parcelasPre: null, parcelasPos: null })).toHaveLength(2);
  });
  it("desconto em texto de exceção não é pendência", () => {
    const excecao = { ...normalizarLinhasIA(IA_JULHO)[0], idEmpreendimento: 1 };
    expect(problemasDaLinha(excecao)).toEqual([]);
  });
  it("linha ignorada nunca tem pendência", () => {
    expect(problemasDaLinha({ ...linhaVazia(), ignorar: true })).toEqual([]);
  });
  it("detecta o mesmo empreendimento em duas linhas (menos as ignoradas)", () => {
    expect(empreendimentosRepetidos([ok, { ...ok }])).toEqual([2]);
    expect(empreendimentosRepetidos([ok, { ...ok, ignorar: true }])).toEqual([]);
  });
});

describe("sanearLinhas (dados vindos da tela)", () => {
  it("apara textos, limita números e exige produto", () => {
    const r = sanearLinhas([
      { produto: "  Verona  ", regional: "rvp1", parcelasPre: "23", parcelasPos: -4, posPercentual: 250, descontoFinanciado: 6, idEmpreendimento: "2", ignorar: true },
      { produto: "" },
      "lixo",
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      produto: "Verona", regional: "RVP", parcelasPre: 23, parcelasPos: null, posPercentual: null, descontoFinanciado: 6,
      idEmpreendimento: 2, ignorar: true,
    });
  });
  it("não aceita o que não é lista", () => {
    expect(sanearLinhas({ a: 1 })).toEqual([]);
  });
});

describe("aplicarComite (coluna da Sousa no Quadro Comparativo)", () => {
  const visita = { descontoPct: 0.04, parcelasPre: 10, parcelasPos: 20, prazoEntregaMeses: 30, entrega: "Jan/2029" };
  const comite: CondicaoComite = {
    descontoPct: 0.06, parcelasPre: 23, parcelasPos: 30, entrega: "2028-05-01", vigenciaInicio: "2026-07-03", vigenciaFim: "2026-07-15",
  };
  it("sem comitê, fica o que veio da visita", () => {
    expect(aplicarComite(visita, null, "2026-07-01")).toEqual(visita);
  });
  it("com comitê, os cinco indicadores vêm dele", () => {
    expect(aplicarComite(visita, comite, "2026-07-01")).toEqual({
      descontoPct: 0.06, parcelasPre: 23, parcelasPos: 30, prazoEntregaMeses: 22, entrega: "Mai/2028",
    });
  });
  it("o prazo acompanha a competência escolhida", () => {
    expect(aplicarComite(visita, comite, "2026-08-01").prazoEntregaMeses).toBe(21);
  });
  it("o que o comitê não traz (exceção em texto, sem entrega) fica com a visita", () => {
    const r = aplicarComite(visita, { ...comite, descontoPct: null, entrega: null }, "2026-07-01");
    expect(r.descontoPct).toBe(0.04);
    expect(r.prazoEntregaMeses).toBe(30);
    expect(r.entrega).toBe("Jan/2029");
    expect(r.parcelasPre).toBe(23);
  });
});

describe("permissão do comitê de vendas", () => {
  it("só o administrador", () => {
    expect(temPermissao(["admin"], "comiteVendas")).toBe(true);
    for (const p of ["coordenador_market_share", "supervisor_parcerias", "coordenador_produto", "diretoria", "avaliador"]) {
      expect(temPermissao([p], "comiteVendas")).toBe(false);
    }
  });
});
