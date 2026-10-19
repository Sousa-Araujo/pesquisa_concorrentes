/**
 * Cálculos do Comparativo Sousa x concorrentes (dashboard da Diretoria).
 * Regras puras, sem banco: preço líquido, entrada, fluxo, prazo de entrega,
 * giro de estoque e o resumo do atendimento do Cliente Oculto.
 */

/** Texto do formulário ("8", "8x", "36 parcelas") → número de parcelas. */
export function lerParcelas(texto: string | null | undefined): number | null {
  const m = String(texto ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Previsão de entrega escrita à mão → { ano, mes }. Aceita "Jun/2027",
 * "jun/27", "Junho de 2027", "06/2027", "2027-06".
 */
export function lerEntrega(texto: string | null | undefined): { ano: number; mes: number } | null {
  const t = String(texto ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return null;
  const ano4 = (a: string) => (a.length === 2 ? 2000 + Number(a) : Number(a));
  let m = t.match(/^(\d{4})-(\d{1,2})/);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  m = t.match(/^(\d{1,2})\s*[/.-]\s*(\d{2}|\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { ano: ano4(m[2]), mes: Number(m[1]) };
  m = t.match(/([a-z]{3})[a-z]*\.?\s*(?:\/|de|-)?\s*(\d{4}|\d{2})/);
  if (m) {
    const i = MESES.indexOf(m[1]);
    if (i >= 0) return { ano: ano4(m[2]), mes: i + 1 };
  }
  return null;
}

/** Meses entre a competência ("AAAA-MM-01") e a entrega. Negativo vira 0 (já entregue). */
export function mesesAteEntrega(competencia: string, entrega: { ano: number; mes: number } | null): number | null {
  if (!entrega) return null;
  const [a, m] = competencia.split("-").map(Number);
  return Math.max(0, (entrega.ano - a) * 12 + (entrega.mes - m));
}

export function rotuloEntrega(entrega: { ano: number; mes: number } | null): string | null {
  if (!entrega) return null;
  const nome = MESES[entrega.mes - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)}/${entrega.ano}`;
}

export interface EntradaPreco {
  valorTabelaCentavos: number | null;
  descontoTipo: "valor" | "percentual" | null;
  descontoValorCentavos: number | null;
  descontoPercentual: number | null;
  valorAtoCentavos: number | null;
  areaM2: number | null;
}

export interface Preco {
  valorTabela: number | null;
  ticketLiquido: number | null;
  porM2: number | null;
  descontoReais: number | null;
  descontoPct: number | null;
  ato: number | null;
  atoPct: number | null;
}

/** Valores em reais. Ticket líquido = tabela − desconto; R$/m² e ato % sobre o ticket líquido. */
export function calcularPreco(e: EntradaPreco): Preco {
  const tabela = e.valorTabelaCentavos ? e.valorTabelaCentavos / 100 : null;
  let desconto: number | null = null;
  if (tabela !== null) {
    if (e.descontoTipo === "valor" && e.descontoValorCentavos !== null) desconto = e.descontoValorCentavos / 100;
    else if (e.descontoTipo === "percentual" && e.descontoPercentual !== null) desconto = (tabela * e.descontoPercentual) / 100;
  }
  const liquido = tabela !== null ? tabela - (desconto ?? 0) : null;
  const ato = e.valorAtoCentavos ? e.valorAtoCentavos / 100 : null;
  return {
    valorTabela: tabela,
    ticketLiquido: liquido,
    porM2: liquido !== null && e.areaM2 ? liquido / e.areaM2 : null,
    descontoReais: desconto,
    descontoPct: desconto !== null && tabela ? desconto / tabela : null,
    ato,
    atoPct: ato !== null && liquido ? ato / liquido : null,
  };
}

export type Giro = "alto" | "moderado" | "lento" | "sem_vendas" | "sem_dados";

/**
 * VSO no modelo da Diretoria = vendas do mês / (estoque no fim do mês + vendas),
 * ou seja, sobre o que estava à venda no começo do mês.
 * Meses para zerar = estoque / vendas do mês.
 */
export function calcularGiro(estoque: number | null, vendas: number | null) {
  if (estoque === null || vendas === null) {
    return { vso: null as number | null, mesesZerar: null as number | null, giro: "sem_dados" as Giro };
  }
  const vso = estoque + vendas > 0 ? vendas / (estoque + vendas) : 0;
  const mesesZerar = vendas > 0 ? estoque / vendas : null;
  const giro: Giro = vendas === 0 ? "sem_vendas" : vso >= 0.15 ? "alto" : vso >= 0.08 ? "moderado" : "lento";
  return { vso, mesesZerar, giro };
}

/**
 * Índices dos melhores valores de uma linha do quadro (destaque em verde).
 * Ignora vazios; só destaca quando há pelo menos dois valores para comparar.
 */
export function melhores(valores: (number | null)[], criterio: "menor" | "maior"): Set<number> {
  const validos = valores.map((v, i) => [v, i] as const).filter(([v]) => v !== null) as [number, number][];
  if (validos.length < 2) return new Set();
  const alvo = criterio === "menor" ? Math.min(...validos.map(([v]) => v)) : Math.max(...validos.map(([v]) => v));
  return new Set(validos.filter(([v]) => Math.abs(v - alvo) < 1e-9).map(([, i]) => i));
}

export const PILAR_CURTO: Record<string, string> = {
  recepcao: "Recepção", corretorAtend: "Corretor", pdv: "PDV", materiais: "Marketing",
  negociacao: "Negociação", conhecimento: "Conhecimento técnico",
};

const virgula = (n: number) => n.toFixed(1).replace(".", ",");

/** Resumo curto do atendimento: pontos fortes (≥ 8), fracos (< 7) e o gap mais grave. */
export function resumoAtendimento(pilares: { key: string; nota: number | null }[], gapMaisGrave: string | null): string {
  const avaliados = pilares.filter((p) => p.nota !== null) as { key: string; nota: number }[];
  const fortes = avaliados.filter((p) => p.nota >= 8).sort((a, b) => b.nota - a.nota);
  const fracos = avaliados.filter((p) => p.nota < 7).sort((a, b) => a.nota - b.nota);
  const partes: string[] = [];
  if (fortes.length) partes.push(`Fortes: ${fortes.map((p) => `${PILAR_CURTO[p.key] ?? p.key} (${virgula(p.nota)})`).join(", ")}.`);
  if (fracos.length) partes.push(`Fracos: ${fracos.map((p) => `${PILAR_CURTO[p.key] ?? p.key} (${virgula(p.nota)})`).join(", ")}.`);
  if (gapMaisGrave) partes.push(`Principal gap: ${gapMaisGrave}`);
  return partes.join(" ") || "Sem detalhes por pilar.";
}

/** Nome comparável: sem acento, minúsculo e com espaços simples (liga visitas antigas pelo nome). */
export function nomeComparavel(s: string | null | undefined): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
