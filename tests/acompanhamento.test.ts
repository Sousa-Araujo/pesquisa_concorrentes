import { describe, expect, it } from "vitest";
import {
  classificarEnvio, filtrarEnvios, mesDoParametro, resumirEnvios, type LinhaEnvio,
} from "@/lib/domain/acompanhamento";

const l = (id: number, regional: string, idCidade: number, idEmp: number, status: LinhaEnvio["status"]): LinhaEnvio => ({
  idConcorrente: id, concorrente: `C${id}`, idEmpreendimento: idEmp, empreendimento: `E${idEmp}`,
  idCidade, cidade: `Cidade ${idCidade}`, regional, status, detalhe: null, idLeitura: null, enviadoEm: null,
  enviadoPor: null, estoque: null, vendas: null, paraConferir: false,
});

const base = [
  l(1, "Alto Tietê", 10, 100, "aprovado"),
  l(2, "Alto Tietê", 10, 100, "pendente"),
  l(3, "Alto Tietê", 11, 110, "pendente"),
  l(4, "Guarulhos", 20, 200, "aprovado"),
];

describe("classificarEnvio", () => {
  it("só a leitura aprovada conta como enviado", () => {
    expect(classificarEnvio("aprovada")).toEqual({ status: "aprovado", detalhe: null });
  });
  it("sem leitura fica pendente, sem detalhe", () => {
    expect(classificarEnvio(null)).toEqual({ status: "pendente", detalhe: null });
  });
  it("leitura não aprovada fica pendente, com o motivo", () => {
    expect(classificarEnvio("para_conferir").detalhe).toBe("Aguardando conferência");
    expect(classificarEnvio("recusada").status).toBe("pendente");
    expect(classificarEnvio("lendo").detalhe).toBe("Lendo");
  });
});

describe("resumirEnvios", () => {
  it("total = enviados + pendentes", () => {
    expect(resumirEnvios(base)).toEqual({ total: 4, enviados: 2, pendentes: 2 });
    expect(resumirEnvios([])).toEqual({ total: 0, enviados: 0, pendentes: 0 });
  });
});

describe("filtrarEnvios", () => {
  it("filtra por regional, cidade e empreendimento", () => {
    expect(filtrarEnvios(base, { regional: "Alto Tietê" })).toHaveLength(3);
    expect(filtrarEnvios(base, { regional: "Alto Tietê", idCidade: "11" }).map((x) => x.idConcorrente)).toEqual([3]);
    expect(filtrarEnvios(base, { idEmpreendimento: "200" }).map((x) => x.idConcorrente)).toEqual([4]);
  });
  it("status só entra quando pedido, para os indicadores contarem todos", () => {
    expect(filtrarEnvios(base, { status: "pendente" })).toHaveLength(2);
    expect(filtrarEnvios(base, { status: "pendente" }, false)).toHaveLength(4);
  });
});

describe("mesDoParametro", () => {
  it("aceita YYYY-MM e YYYY-MM-01", () => {
    expect(mesDoParametro("2026-11")).toBe("2026-11-01");
    expect(mesDoParametro("2026-11-01")).toBe("2026-11-01");
  });
  it("rejeita o resto", () => {
    for (const v of [undefined, "", "2026-13", "2026-11-15", "novembro", "2026-00"]) expect(mesDoParametro(v)).toBeNull();
  });
});
