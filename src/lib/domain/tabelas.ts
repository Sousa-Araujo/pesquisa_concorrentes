/**
 * Cálculos do módulo Tabelas e espelhos, a partir da lista de unidades lida
 * do documento (pela IA ou corrigida na conferência). Regras combinadas:
 *  - estoque = disponíveis + reservadas (reserva ainda pode cair);
 *  - vendas do mês = unidades que viraram "vendida" desde a última leitura
 *    aprovada; sem leitura anterior, estoque do mês anterior − estoque atual;
 *  - maior, menor e ticket médio: só das unidades disponíveis, calculados
 *    para o valor de tabela e, quando o documento traz, para o valor com desconto.
 */

export type StatusUnidade = "disponivel" | "reservada" | "vendida" | "outro";

export interface Unidade {
  unidade: string;
  /** Valor de tabela (ou o único valor, quando o documento só traz um). */
  valorCentavos: number | null;
  /** Valor com desconto, quando o documento traz (ex.: desconto bom pagador). */
  valorDescontoCentavos?: number | null;
  status: StatusUnidade;
  /** O texto que estava no documento (ex.: "Reservada Roger"). */
  statusOriginal?: string;
}

export interface Resumo {
  totalUnidades: number;
  estoque: number;
  disponiveis: number;
  reservadas: number;
  vendidasTotal: number;
  vendasMes: number | null;
  vendasMetodo: "unidades" | "estoque" | null;
  valorMin: number | null;
  valorMax: number | null;
  ticketMedio: number | null;
  unidadeMin: string | null;
  unidadeMax: string | null;
  descontoMin: number | null;
  descontoMax: number | null;
  ticketDesconto: number | null;
}

const chave = (u: string) => u.toLowerCase().replace(/\s+/g, " ").trim();

/** Maior, menor e média de um dos valores das unidades (ignora vazios). */
function faixa(unidades: Unidade[], valor: (u: Unidade) => number | null | undefined) {
  let min: { u: Unidade; v: number } | null = null;
  let max: { u: Unidade; v: number } | null = null;
  let soma = 0;
  let n = 0;
  for (const u of unidades) {
    const v = valor(u);
    if (v === null || v === undefined || !(v > 0)) continue;
    if (!min || v < min.v) min = { u, v };
    if (!max || v > max.v) max = { u, v };
    soma += v;
    n++;
  }
  return { min, max, media: n ? Math.round(soma / n) : null };
}

export function resumirUnidades(
  unidades: Unidade[],
  anterior: { unidades: Unidade[] } | null,
  estoqueMesAnterior: number | null,
): Resumo {
  const disp = unidades.filter((u) => u.status === "disponivel");
  const res = unidades.filter((u) => u.status === "reservada");
  const vend = unidades.filter((u) => u.status === "vendida");
  const estoque = disp.length + res.length;

  let vendasMes: number | null = null;
  let vendasMetodo: Resumo["vendasMetodo"] = null;
  if (anterior && anterior.unidades.length) {
    const antes = new Map(anterior.unidades.map((u) => [chave(u.unidade), u.status]));
    vendasMes = vend.filter((u) => antes.has(chave(u.unidade)) && antes.get(chave(u.unidade)) !== "vendida").length;
    vendasMetodo = "unidades";
  } else if (estoqueMesAnterior !== null) {
    vendasMes = Math.max(0, estoqueMesAnterior - estoque);
    vendasMetodo = "estoque";
  }

  const tabela = faixa(disp, (u) => u.valorCentavos);
  const desconto = faixa(disp, (u) => u.valorDescontoCentavos);

  return {
    totalUnidades: unidades.length,
    estoque,
    disponiveis: disp.length,
    reservadas: res.length,
    vendidasTotal: vend.length,
    vendasMes,
    vendasMetodo,
    valorMin: tabela.min?.v ?? null,
    valorMax: tabela.max?.v ?? null,
    ticketMedio: tabela.media,
    unidadeMin: tabela.min?.u.unidade ?? null,
    unidadeMax: tabela.max?.u.unidade ?? null,
    descontoMin: desconto.min?.v ?? null,
    descontoMax: desconto.max?.v ?? null,
    ticketDesconto: desconto.media,
  };
}

const centavos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null);

/**
 * Normaliza o que a IA devolveu (valores em reais → centavos, status
 * desconhecido → "outro"). Aceita "valor_tabela"/"valor_desconto" e o antigo "valor".
 */
export function normalizarUnidades(brutas: unknown): Unidade[] {
  if (!Array.isArray(brutas)) return [];
  const validos: StatusUnidade[] = ["disponivel", "reservada", "vendida", "outro"];
  return brutas
    .map((b) => b as Record<string, unknown>)
    .filter((b) => b && String(b.unidade ?? "").trim())
    .map((b) => {
      const status = validos.includes(b.status as StatusUnidade) ? (b.status as StatusUnidade) : "outro";
      let tabela = centavos(b.valor_tabela ?? b.valor);
      let desconto = centavos(b.valor_desconto);
      // Só um valor: ele é o de tabela. Desconto igual à tabela não é desconto.
      if (tabela === null && desconto !== null) { tabela = desconto; desconto = null; }
      if (desconto !== null && desconto === tabela) desconto = null;
      return {
        unidade: String(b.unidade).trim(),
        valorCentavos: tabela,
        valorDescontoCentavos: desconto,
        status,
        statusOriginal: b.status_original ? String(b.status_original) : undefined,
      };
    });
}
