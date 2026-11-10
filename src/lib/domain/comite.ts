/**
 * Comitê de vendas: regras puras (sem banco) da leitura do PDF mensal do
 * comitê e de como as condições entram no Quadro Comparativo.
 *
 * Do PDF só interessam, por produto: Previsão de Entrega, "Ato + Parc."
 * (parcelas pré-chaves), Pré-soluto (nº de parcelas = pós-chaves, e %) e o
 * desconto máximo por venda (financiado e à vista). Prêmio, share e meta de
 * vendas ficam de fora (são do GDP).
 *
 * Mesma filosofia do GDP: percentual que vem como texto de exceção
 * ("Qualquer unidade a R$ 251.900,00…") não vira número — o texto fica de
 * observação para quem confere.
 */
import { lerEntrega, mesesAteEntrega, nomeNucleo, rotuloEntrega } from "./comparativo";

export interface LinhaComite {
  /** Código da regional no PDF (RVP, RAT, RGC, RSP). */
  regional: string;
  /** Produto como escrito no PDF. */
  produto: string;
  /** Previsão de entrega como escrita no PDF ("junho/27"). */
  previsaoEntrega: string;
  /** "Ato + Parc.": parcelas pré-chaves, já contando o ato. */
  parcelasPre: number | null;
  /** Pré-soluto, nº de parcelas: parcelas pós-chaves. */
  parcelasPos: number | null;
  /** Pré-soluto, % (12 = 12%). */
  posPercentual: number | null;
  /** Desconto máximo por venda financiada, em pontos percentuais (7,5 = 7,5%). */
  descontoFinanciado: number | null;
  descontoFinanciadoObs: string;
  /** Desconto máximo por venda à vista. */
  descontoAvista: number | null;
  descontoAvistaObs: string;
  /** Empreendimento do cadastro a que a linha se refere (null = ainda sem ligação). */
  idEmpreendimento: number | null;
  /** Produto que não entra no sistema (ex.: fora do cadastro): não é gravado na aprovação. */
  ignorar: boolean;
}

/** Linha vazia, para incluir à mão na conferência. */
export const linhaVazia = (): LinhaComite => ({
  regional: "", produto: "", previsaoEntrega: "", parcelasPre: null, parcelasPos: null, posPercentual: null,
  descontoFinanciado: null, descontoFinanciadoObs: "", descontoAvista: null, descontoAvistaObs: "",
  idEmpreendimento: null, ignorar: false,
});

/**
 * "7,50%" → { pct: 7.5 }. Texto que não é percentual limpo vira
 * { pct: null, obs: texto } (decisão do GDP: quem confere revisa).
 */
export function lerPercentualOuTexto(valor: unknown): { pct: number | null; obs: string } {
  if (typeof valor === "number") return Number.isFinite(valor) && valor >= 0 && valor <= 100 ? { pct: valor, obs: "" } : { pct: null, obs: String(valor) };
  const texto = String(valor ?? "").replace(/\s+/g, " ").trim();
  if (!texto) return { pct: null, obs: "" };
  const limpo = texto.replace(/%/g, "").trim();
  if (/^\d+(?:[.,]\d+)?$/.test(limpo)) {
    const n = Number(limpo.replace(",", "."));
    if (n >= 0 && n <= 100) return { pct: n, obs: "" };
  }
  return { pct: null, obs: texto };
}

function inteiro(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\D/g, ""));
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

const texto = (v: unknown, max = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Código de regional (RVP, RAT…) como no PDF; qualquer outra coisa vira vazio para quem confere preencher. */
const regional = (v: unknown) => texto(v, 8).toUpperCase().replace(/[^A-Z]/g, "");

/**
 * Lista devolvida pela IA → linhas do domínio. Descarta o que não é objeto,
 * linhas sem produto e a linha de totais.
 */
export function normalizarLinhasIA(brutas: unknown): LinhaComite[] {
  if (!Array.isArray(brutas)) return [];
  const linhas: LinhaComite[] = [];
  for (const b of brutas) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    const produto = texto(r.produto, 150);
    if (!produto || /^totais?$/i.test(produto)) continue;
    const fin = lerPercentualOuTexto(r.desconto_financiado);
    const avi = lerPercentualOuTexto(r.desconto_avista);
    const pos = lerPercentualOuTexto(r.presoluto_percentual);
    linhas.push({
      regional: regional(r.regional),
      produto,
      previsaoEntrega: texto(r.previsao_entrega, 40),
      parcelasPre: inteiro(r.ato_parcelas, 600),
      parcelasPos: inteiro(r.presoluto_parcelas, 600),
      posPercentual: pos.pct,
      descontoFinanciado: fin.pct, descontoFinanciadoObs: fin.obs,
      descontoAvista: avi.pct, descontoAvistaObs: avi.obs,
      idEmpreendimento: null,
      ignorar: false,
    });
  }
  return linhas;
}

/**
 * Linhas vindas da tela de conferência (dados não confiáveis) → linhas
 * saneadas: textos aparados, números dentro da faixa e vínculo inteiro.
 */
export function sanearLinhas(brutas: unknown): LinhaComite[] {
  if (!Array.isArray(brutas)) return [];
  return brutas.slice(0, 200).flatMap((b): LinhaComite[] => {
    if (!b || typeof b !== "object") return [];
    const r = b as Record<string, unknown>;
    const produto = texto(r.produto, 150);
    if (!produto) return [];
    const pct = (v: unknown) => { const n = typeof v === "number" ? v : Number(v); return v !== null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null; };
    const id = Number(r.idEmpreendimento);
    return [{
      regional: regional(r.regional),
      produto,
      previsaoEntrega: texto(r.previsaoEntrega, 40),
      parcelasPre: inteiro(r.parcelasPre, 600),
      parcelasPos: inteiro(r.parcelasPos, 600),
      posPercentual: pct(r.posPercentual),
      descontoFinanciado: pct(r.descontoFinanciado), descontoFinanciadoObs: texto(r.descontoFinanciadoObs, 255),
      descontoAvista: pct(r.descontoAvista), descontoAvistaObs: texto(r.descontoAvistaObs, 255),
      idEmpreendimento: Number.isInteger(id) && id > 0 ? id : null,
      ignorar: r.ignorar === true,
    }];
  });
}

const ROMANOS = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/**
 * Chave para ligar o nome do PDF ao do cadastro: sem acento/pontuação/
 * prefixos genéricos e com a etapa em romano ("SAFIRA M2", "Safira 2" e
 * "Residencial Safira II" dão a mesma chave).
 */
export function chaveEmpreendimento(nome: string | null | undefined): string {
  return nomeNucleo(nome)
    .split(" ")
    .map((t) => {
      const m = t.match(/^m?(\d{1,2})$/);
      return m && Number(m[1]) >= 1 && Number(m[1]) <= 10 ? ROMANOS[Number(m[1])] : t;
    })
    .join(" ");
}

export interface EmpreendimentoCadastro { id: number; nome: string }

/**
 * Empreendimento do cadastro para o produto do PDF: primeiro o apelido já
 * aprendido; depois o nome com a mesma chave, só quando é um único candidato.
 */
export function ligarEmpreendimento(
  produto: string, cadastro: readonly EmpreendimentoCadastro[], apelidos: ReadonlyMap<string, number>,
): number | null {
  const chave = chaveEmpreendimento(produto);
  if (!chave) return null;
  const apelido = apelidos.get(chave);
  if (apelido && cadastro.some((e) => e.id === apelido)) return apelido;
  const iguais = cadastro.filter((e) => chaveEmpreendimento(e.nome) === chave);
  return iguais.length === 1 ? iguais[0].id : null;
}

const ETAPA = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const etapaDe = (chave: string) => { const t = chave.split(" ").pop() ?? ""; return ETAPA.test(t) ? t : ""; };
const semEtapa = (chave: string) => (etapaDe(chave) ? chave.slice(0, chave.lastIndexOf(" ")) : chave);

/**
 * Aproximação para quando o nome não bate inteiro: o PDF diz "SOROCABA M1" e
 * o cadastro "SOU VIVER SOROCABA" (sem etapa), ou o PDF diz "GUAIANASES" e o
 * cadastro "SOU MAIS GUAIANASES". Só vale com um único candidato; etapas
 * diferentes (M1 x II) nunca casam.
 */
function ligarAproximado(produto: string, cadastro: readonly EmpreendimentoCadastro[]): number | null {
  const chave = chaveEmpreendimento(produto);
  if (!chave) return null;
  const candidatos = cadastro.filter((e) => {
    const k = chaveEmpreendimento(e.nome);
    if (etapaDe(k) && etapaDe(chave) && etapaDe(k) !== etapaDe(chave)) return false;
    const a = semEtapa(k), b = semEtapa(chave);
    const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
    return a === b || (curto.length >= 6 && longo.endsWith(` ${curto}`));
  });
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/**
 * Liga as linhas ainda sem empreendimento (não mexe no que a pessoa já
 * escolheu). Primeiro o nome exato/apelido; depois o aproximado, que só vale
 * se uma única linha o pedir e o empreendimento não for de outra linha.
 */
export function ligarLinhas(
  linhas: readonly LinhaComite[], cadastro: readonly EmpreendimentoCadastro[], apelidos: ReadonlyMap<string, number>,
): LinhaComite[] {
  const exatos = linhas.map((l) => l.idEmpreendimento ?? ligarEmpreendimento(l.produto, cadastro, apelidos));
  const usados = new Set(exatos.filter((id): id is number => id !== null));
  const aprox = linhas.map((l, i) => (exatos[i] !== null ? null : ligarAproximado(l.produto, cadastro)));
  const pedidos = new Map<number, number>();
  for (const id of aprox) if (id !== null) pedidos.set(id, (pedidos.get(id) ?? 0) + 1);
  return linhas.map((l, i) => {
    const sugerido = aprox[i];
    const id = exatos[i] ?? (sugerido !== null && !usados.has(sugerido) && pedidos.get(sugerido) === 1 ? sugerido : null);
    return id === l.idEmpreendimento ? l : { ...l, idEmpreendimento: id };
  });
}

/** "junho/27" → "2027-06-01" (null se não for uma data de entrega reconhecível). */
export function entregaComoData(previsao: string): string | null {
  const e = lerEntrega(previsao);
  return e ? `${e.ano}-${String(e.mes).padStart(2, "0")}-01` : null;
}

/** Meses da competência ("AAAA-MM-01") até a entrega escrita no PDF; 0 = já entregue. */
export function prazoAteEntrega(previsao: string, competencia: string): number | null {
  return mesesAteEntrega(competencia, lerEntrega(previsao));
}

/** Problemas que impedem ou merecem atenção antes de aprovar (texto para a tela). */
export function problemasDaLinha(l: LinhaComite): string[] {
  if (l.ignorar) return [];
  const p: string[] = [];
  if (!l.idEmpreendimento) p.push("Escolha o empreendimento do cadastro (ou marque para ignorar).");
  if (l.previsaoEntrega && !lerEntrega(l.previsaoEntrega)) p.push("Previsão de entrega não reconhecida (use, por exemplo, junho/27).");
  if (l.parcelasPre === null) p.push("Falta o nº de parcelas pré-chaves (Ato + Parc.).");
  if (l.parcelasPos === null) p.push("Falta o nº de parcelas pós-chaves (Pré-soluto).");
  if (l.descontoFinanciado === null && !l.descontoFinanciadoObs) p.push("Falta o desconto máximo financiado.");
  return p;
}

/** Empreendimentos escolhidos em mais de uma linha (cada um só pode ter uma condição por comitê). */
export function empreendimentosRepetidos(linhas: readonly LinhaComite[]): number[] {
  const vistos = new Set<number>();
  const repetidos = new Set<number>();
  for (const l of linhas) {
    if (l.ignorar || !l.idEmpreendimento) continue;
    if (vistos.has(l.idEmpreendimento)) repetidos.add(l.idEmpreendimento);
    vistos.add(l.idEmpreendimento);
  }
  return [...repetidos];
}

/** Condição aprovada de um empreendimento, como o Quadro Comparativo a usa. */
export interface CondicaoComite {
  /** Desconto máximo financiado, em fração (0,075 = 7,5%); null quando o PDF trouxe texto de exceção. */
  descontoPct: number | null;
  parcelasPre: number | null;
  parcelasPos: number | null;
  /** Primeiro dia do mês da entrega ("AAAA-MM-01"). */
  entrega: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
}

export interface IndicadoresComite {
  descontoPct: number | null;
  parcelasPre: number | null;
  parcelasPos: number | null;
  prazoEntregaMeses: number | null;
  entrega: string | null;
}

/**
 * Indicadores do Quadro Comparativo da Sousa: onde o comitê traz o dado, ele
 * vale; onde não traz (ou não há comitê), fica o que já vinha da visita do
 * Cliente Oculto / do CV.
 */
export function aplicarComite(base: IndicadoresComite, c: CondicaoComite | null, competencia: string): IndicadoresComite {
  if (!c) return base;
  const entrega = c.entrega ? { ano: Number(c.entrega.slice(0, 4)), mes: Number(c.entrega.slice(5, 7)) } : null;
  return {
    descontoPct: c.descontoPct ?? base.descontoPct,
    parcelasPre: c.parcelasPre ?? base.parcelasPre,
    parcelasPos: c.parcelasPos ?? base.parcelasPos,
    prazoEntregaMeses: entrega ? mesesAteEntrega(competencia, entrega) : base.prazoEntregaMeses,
    entrega: entrega ? rotuloEntrega(entrega) : base.entrega,
  };
}
