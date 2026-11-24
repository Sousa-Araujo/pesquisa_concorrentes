import { describe, expect, it } from "vitest";
import {
  foiRealizada, montarAcompanhamento, resumirAcompanhamento, situacaoDaVisita,
  type AlvoPesquisa, type VisitaDoMes,
} from "@/lib/domain/acompanhamentoCO";

const alvos: AlvoPesquisa[] = [
  { tipo: "sousa", id: 1, nome: "Sou Viver Roma", referencia: null, regional: "RVP" },
  { tipo: "sousa", id: 2, nome: "Sou Viver Sorocaba", referencia: null, regional: "RAT" },
  { tipo: "concorrente", id: 10, nome: "Residencial Alfa", referencia: "Sou Viver Roma", regional: "RVP" },
  { tipo: "concorrente", id: 11, nome: "Lumi", referencia: "Sou Viver Roma", regional: "RVP" },
];

const visita = (o: Partial<VisitaDoMes>): VisitaDoMes => ({
  id: "CO-1", status: "Concluída", tipo: "sousa", idEmpreendimento: null, idConcorrente: null,
  nomeTexto: null, dataVisita: "2026-11-10", somentePrevia: false, ...o,
});

describe("situacaoDaVisita", () => {
  it("concluída e aguardando calibragem contam como realizadas; rascunho não", () => {
    expect(foiRealizada(situacaoDaVisita("Concluída"))).toBe(true);
    expect(foiRealizada(situacaoDaVisita("Aguardando Calibragem"))).toBe(true);
    expect(foiRealizada(situacaoDaVisita("Em Preenchimento"))).toBe(false);
  });
});

describe("montarAcompanhamento", () => {
  it("liga a visita pelo cadastro e, nas antigas sem ligação, pelo nome", () => {
    const itens = montarAcompanhamento(alvos, [
      visita({ id: "CO-1", idEmpreendimento: 1 }),
      visita({ id: "CO-2", tipo: "concorrente", nomeTexto: "  RESIDENCIAL alfa " }),
    ]);
    expect(itens.find((i) => i.id === 1 && i.tipo === "sousa")?.situacao).toBe("concluida");
    expect(itens.find((i) => i.id === 10)?.situacao).toBe("concluida");
    expect(itens.find((i) => i.id === 2)?.situacao).toBe("sem_visita");
    expect(itens.find((i) => i.id === 11)?.situacao).toBe("sem_visita");
  });

  it("visita de concorrente não conta para o empreendimento Sousa de mesmo nome", () => {
    const itens = montarAcompanhamento(alvos, [visita({ tipo: "concorrente", nomeTexto: "Sou Viver Roma" })]);
    expect(itens.find((i) => i.tipo === "sousa" && i.id === 1)?.situacao).toBe("sem_visita");
  });

  it("com várias visitas no mês vale a mais avançada", () => {
    const itens = montarAcompanhamento(alvos, [
      visita({ id: "CO-1", idEmpreendimento: 2, status: "Em Preenchimento" }),
      visita({ id: "CO-2", idEmpreendimento: 2, status: "Aguardando Calibragem" }),
      visita({ id: "CO-3", idEmpreendimento: 2, status: "Em Preenchimento" }),
    ]);
    const i = itens.find((x) => x.tipo === "sousa" && x.id === 2)!;
    expect(i.situacao).toBe("calibragem");
    expect(i.avaliacaoId).toBe("CO-2");
    expect(i.visitas).toBe(3);
  });

  it("só rascunho fica entre as não realizadas", () => {
    const itens = montarAcompanhamento(alvos, [visita({ idEmpreendimento: 1, status: "Em Preenchimento" })]);
    expect(itens.find((i) => i.tipo === "sousa" && i.id === 1)?.situacao).toBe("rascunho");
  });
});

describe("resumirAcompanhamento", () => {
  it("conta esperadas, realizadas, não realizadas e o cumprimento", () => {
    const itens = montarAcompanhamento(alvos, [
      visita({ id: "CO-1", idEmpreendimento: 1 }),
      visita({ id: "CO-2", idEmpreendimento: 2, status: "Aguardando Calibragem" }),
      visita({ id: "CO-3", tipo: "concorrente", idConcorrente: 10, status: "Em Preenchimento" }),
    ]);
    const r = resumirAcompanhamento(itens);
    expect(r).toMatchObject({ esperadas: 4, realizadas: 2, naoRealizadas: 2, concluidas: 1, emCalibragem: 1, rascunhos: 1, semVisita: 1 });
    expect(r.cumprimento).toBe(0.5);
  });

  it("sem nada esperado o cumprimento é 0", () => {
    expect(resumirAcompanhamento([]).cumprimento).toBe(0);
  });
});
