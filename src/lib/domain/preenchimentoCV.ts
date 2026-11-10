/**
 * Preenchimento de meses anteriores com os dados do CV (regras puras).
 *
 * O BI do CV só guarda a foto de hoje do estoque, então, para um mês que
 * já fechou:
 *  - vendas e ticket com desconto saem exatos de `fato_venda`;
 *  - estoque do fim do mês = estoque de hoje + vendas feitas depois do mês
 *    (estimativa: ignora distratos e unidades novas);
 *  - ticket de tabela = média das unidades em estoque cuja tabela já valia
 *    no mês (sem data de vigência, ou vigência posterior, fica em branco).
 * Só cria o que o Hub ainda não tem; nada digitado é alterado.
 */

export type SituacaoPreenchimento = "novo" | "ja_cv" | "manual_igual" | "manual_diverge" | "sem_cv";

export interface ExistenteMes { origem: "manual" | "cv"; estoque: number; vendas: number }
export interface CalculadoCV { estoque: number; vendas: number }

export function classificarPreenchimento(existente: ExistenteMes | null, cv: CalculadoCV | null): SituacaoPreenchimento {
  if (!cv) return "sem_cv";
  if (!existente) return "novo";
  if (existente.origem === "cv") return "ja_cv";
  return existente.estoque === cv.estoque && existente.vendas === cv.vendas ? "manual_igual" : "manual_diverge";
}

/** Estoque do fim do mês: o de hoje mais o que foi vendido depois do mês. */
export function estoqueDoFimDoMes(estoqueHoje: number, vendasDepoisDoMes: number): number {
  return Math.max(0, estoqueHoje) + Math.max(0, vendasDepoisDoMes);
}

/** "AAAA-MM-01" de um mês já fechado (anterior a `mesAtual`) e a partir de 2025; senão null. */
export function lerMesPreenchivel(valor: string, mesAtual: string): string | null {
  const m = /^(\d{4})-(\d{2})-01$/.exec(valor);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  if (valor < "2025-01-01" || valor >= mesAtual) return null;
  return valor;
}

/** Primeiro dia do mês seguinte (YYYY-MM-01 → YYYY-MM-01). */
export function mesSeguinte(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
}
