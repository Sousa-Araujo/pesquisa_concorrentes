import { describe, expect, it } from "vitest";
import { cpfValido } from "@/lib/domain/cpf";

describe("cpfValido", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
  });
  it("recusa dígito verificador errado, números repetidos e tamanho errado", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529.982.247-25")).toBe(false);
  });
});
