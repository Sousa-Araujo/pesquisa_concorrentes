import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/** Carrega o config.js do Cliente Oculto (script de navegador) num ambiente mínimo. */
function carregar() {
  const codigo = readFileSync(join(process.cwd(), "public/cliente-oculto/js/config.js"), "utf8");
  const documento = { addEventListener() {}, removeEventListener() {}, createElement: () => ({}), body: {} };
  const janela: Record<string, unknown> = { document: documento };
  vm.runInNewContext(codigo, { window: janela, document: documento, Intl });
  return janela.COConfig as {
    moneyFromText: (t: string) => { centavos: number | null; display: string };
    moneyMaskFromDigits: (t: string) => { centavos: number | null; display: string };
  };
}

const { moneyFromText, moneyMaskFromDigits } = carregar();
const NBSP = / /g;
const mostra = (t: string) => moneyFromText(t).display.replace(NBSP, " ");

describe("valores em reais do formulário do Cliente Oculto", () => {
  it("vale o que a pessoa escreve, sem casas a mais", () => {
    expect(moneyFromText("R$ 235.500,00").centavos).toBe(23_550_000);
    expect(mostra("R$ 235.500,00")).toBe("R$ 235.500,00");
    expect(moneyFromText("235.500,00").centavos).toBe(23_550_000);
    expect(moneyFromText("235500,00").centavos).toBe(23_550_000);
  });

  it("sem vírgula o número é em reais", () => {
    expect(moneyFromText("235500").centavos).toBe(23_550_000);
    expect(moneyFromText("235.500").centavos).toBe(23_550_000);
    expect(moneyFromText("350000").centavos).toBe(35_000_000);
  });

  it("vírgula e ponto como separador de centavos", () => {
    expect(moneyFromText("235.500,5").centavos).toBe(23_550_050);
    expect(moneyFromText("1.234,56").centavos).toBe(123_456);
    expect(moneyFromText("235.50").centavos).toBe(23_550);
    expect(moneyFromText("235.500,").centavos).toBe(23_550_000);
  });

  it("digitando tecla a tecla chega no mesmo valor", () => {
    let texto = "";
    for (const c of "235.500,00") texto += c;
    expect(moneyFromText(texto).centavos).toBe(23_550_000);
    expect(moneyFromText("2").centavos).toBe(200);
    expect(moneyFromText("23").centavos).toBe(2_300);
  });

  it("vazio e texto sem número ficam vazios; zero é zero", () => {
    expect(moneyFromText("").centavos).toBeNull();
    expect(moneyFromText("R$").centavos).toBeNull();
    expect(moneyFromText("0").centavos).toBe(0);
  });

  it("não deixa o número explodir", () => {
    expect(moneyFromText("99999999999999").centavos).toBeLessThan(1e13);
  });
});

describe("tela de Correções: texto e número andam juntos", () => {
  it("texto gravado sem centavos ou sem R$ é reformatado e vira o mesmo número", () => {
    for (const [antigo, centavos] of [["347000,00", 34_700_000], ["R$ 347.000", 34_700_000], ["R$ 13.000", 1_300_000], ["R$ 89.000", 8_900_000]] as const) {
      const exibido = moneyFromText(antigo).display;
      // o que a tela mostra, relido pela máscara da Nova avaliação, dá o mesmo número
      expect(moneyMaskFromDigits(exibido).centavos).toBe(centavos);
      expect(moneyMaskFromDigits(exibido).display).toBe(exibido);
    }
  });

  it("a máscara da Nova avaliação continua igual (dígitos entram pela direita)", () => {
    expect(moneyMaskFromDigits("34700000").centavos).toBe(34_700_000);
    expect(moneyMaskFromDigits("235500").centavos).toBe(235_500);
    expect(moneyMaskFromDigits("").centavos).toBeNull();
  });
});
