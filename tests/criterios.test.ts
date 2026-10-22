import { describe, it, expect } from "vitest";
import {
  normalizarRespostas, mediaPilar, pilarAvaliado, evidenciaPilar, pendenciasCriterios, CRITERIOS,
} from "@/lib/cliente-oculto/criterios";

describe("formulário por critérios do Cliente Oculto", () => {
  it("média simples dos itens aplicáveis; 'Não se aplica' fica fora", () => {
    const r = normalizarRespostas("recepcao", {
      "1.1": { nota: 8, evidencia: "a" }, "1.2": { nota: 9, evidencia: "b" },
      "1.3": { na: true, nota: 0, evidencia: "sem cadastro" }, "1.4": { nota: 10, evidencia: "c" },
    });
    expect(r["1.3"]).toEqual({ nota: null, na: true, evidencia: "sem cadastro" });
    expect(mediaPilar(r)).toBe(9);
    expect(pilarAvaliado(r)).toBe(true);
  });

  it("4.4 Sim/Não vira 10/0 e ignora chaves desconhecidas", () => {
    const r = normalizarRespostas("materiais", { "4.4": { nota: 10, evidencia: "x" }, "9.9": { nota: 3 } });
    expect(r["4.4"].nota).toBe(10);
    expect(Object.keys(r)).toEqual(["4.1", "4.2", "4.3", "4.4"]);
    expect(normalizarRespostas("materiais", { "4.4": { nota: 0 } })["4.4"].nota).toBe(0);
  });

  it("recusa nota fora de 0–10", () => {
    expect(() => normalizarRespostas("pdv", { "3.1": { nota: 11 } })).toThrow();
  });

  it("pilar todo 'Não se aplica' fica não avaliado e sem média", () => {
    const r = normalizarRespostas("pdv", Object.fromEntries(CRITERIOS.pdv.map((c) => [c.key, { na: true, evidencia: "fechado" }])));
    expect(pilarAvaliado(r)).toBe(false);
    expect(mediaPilar(r)).toBeNull();
  });

  it("evidência do pilar junta os itens e pendências apontam o que falta", () => {
    const r = normalizarRespostas("materiais", { "4.1": { nota: 7.5, evidencia: "folder" }, "4.4": { nota: 0, evidencia: "não entregou" } });
    expect(evidenciaPilar("materiais", r)).toBe(
      "4.1 Disponibilidade de materiais (7,5): folder\n4.4 Utilidade do material para o cliente (Não): não entregou",
    );
    const falta = pendenciasCriterios({ materiais: r });
    expect(falta).toContain("4.2");
    expect(falta).not.toContain("4.1");
    expect(falta).toContain("1.1");
  });
});
