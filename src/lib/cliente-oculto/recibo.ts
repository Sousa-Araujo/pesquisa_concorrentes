/**
 * Recibo de pagamento do Cliente Oculto (avaliador).
 * Modelo oficial: o avaliador informa nome, telefone, CPF, chave PIX, a
 * quantidade de pesquisas realizadas e o valor unitário, e assina na tela;
 * empreendimento, data e hora da visita vêm da avaliação;
 * o Coordenador de Market Share (ou o administrador) vê o recibo e marca como
 * pago. Mudar qualquer dado depois de assinado apaga a assinatura.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { ErroCO, type Quem } from "./repo";
import { cpfValido } from "@/lib/domain/cpf";

const q = (texto: string, params: unknown[] = []) => db().query(texto, params);

const TIPOS_PIX = ["cpf", "celular", "email", "aleatoria"] as const;
/** Assinatura em PNG feita no navegador; um traço na tela fica bem abaixo disso. */
const ASSINATURA_MAX = 300_000;

async function avaliacaoDoRecibo(quem: Quem, id: string) {
  const { rows: [a] } = await q(
    `select id, avaliador_id, empreendimento_texto, data_visita, horario, cliente_oculto_nome, somente_previa, previa_contato_em
       from co_avaliacoes where id = $1 and not excluida`,
    [id],
  );
  if (!a || (quem.papel === "avaliador" && a.avaliador_id !== quem.id_usuario)) {
    throw new ErroCO(404, "Avaliação não encontrada");
  }
  return a;
}

function paraTela(a: Record<string, unknown>, r: Record<string, unknown> | undefined) {
  return {
    avaliacao: {
      id: a.id,
      empreendimento: a.empreendimento_texto,
      dataVisita: a.data_visita,
      horario: a.horario,
      previaContatoEm: a.previa_contato_em,
      clienteOculto: a.cliente_oculto_nome,
      somentePrevia: !!a.somente_previa,
    },
    recibo: {
      nomeCompleto: r?.nome_completo ?? "",
      telefone: r?.telefone ?? "",
      cpf: r?.cpf ?? "",
      chavePixTipo: r?.chave_pix_tipo ?? "",
      chavePix: r?.chave_pix ?? "",
      quantidadePesquisas: r?.quantidade_pesquisas ?? null,
      valorUnitarioCentavos: r?.valor_unitario_centavos === null || r?.valor_unitario_centavos === undefined ? null : Number(r.valor_unitario_centavos),
      valorCentavos: r?.valor_centavos === null || r?.valor_centavos === undefined ? null : Number(r.valor_centavos),
      assinatura: r?.assinatura ?? null,
      assinadoEm: r?.assinado_em ?? null,
      pagoEm: r?.pago_em ?? null,
    },
  };
}

export async function obterRecibo(quem: Quem, id: string) {
  const a = await avaliacaoDoRecibo(quem, id);
  const { rows: [r] } = await q(`select * from co_recibos where avaliacao_id = $1`, [id]);
  return paraTela(a, r);
}

async function exigirNaoPago(id: string) {
  const { rows: [r] } = await q(`select pago_em from co_recibos where avaliacao_id = $1`, [id]);
  if (r?.pago_em) throw new ErroCO(409, "Este recibo já foi pago e não pode mais ser alterado.");
}

/** Salva os dados do recibo. Qualquer mudança apaga a assinatura anterior. */
export async function salvarRecibo(quem: Quem, id: string, c: Record<string, unknown>) {
  await avaliacaoDoRecibo(quem, id);
  await exigirNaoPago(id);
  const texto = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);
  const cpf = texto(c.cpf)?.replace(/\D/g, "") || null;
  if (cpf && !/^\d{11}$/.test(cpf)) throw new ErroCO(400, "CPF deve ter 11 números.");
  const tipo = texto(c.chavePixTipo);
  if (tipo && !(TIPOS_PIX as readonly string[]).includes(tipo)) throw new ErroCO(400, "Tipo de chave PIX inválido.");
  const inteiroPositivo = (v: unknown, erro: string): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new ErroCO(400, erro);
    return n;
  };
  const quantidade = inteiroPositivo(c.quantidadePesquisas, "Quantidade de pesquisas inválida.");
  const unitario = inteiroPositivo(c.valorUnitarioCentavos, "Valor unitário inválido.");
  // Valor total sempre calculado aqui, nunca digitado.
  const total = quantidade && unitario ? quantidade * unitario : null;
  await q(
    `insert into co_recibos (avaliacao_id, nome_completo, telefone, cpf, chave_pix_tipo, chave_pix,
                             quantidade_pesquisas, valor_unitario_centavos, valor_centavos)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (avaliacao_id) do update set
       nome_completo = excluded.nome_completo, telefone = excluded.telefone, cpf = excluded.cpf,
       chave_pix_tipo = excluded.chave_pix_tipo, chave_pix = excluded.chave_pix,
       quantidade_pesquisas = excluded.quantidade_pesquisas, valor_unitario_centavos = excluded.valor_unitario_centavos,
       valor_centavos = excluded.valor_centavos,
       assinatura = null, assinado_em = null, atualizado_em = now()`,
    [id, texto(c.nomeCompleto), texto(c.telefone)?.replace(/\D/g, "") || null, cpf, tipo, texto(c.chavePix),
      quantidade, unitario, total],
  );
  return obterRecibo(quem, id);
}

/** Assina: exige todos os dados preenchidos e um CPF válido. */
export async function assinarRecibo(quem: Quem, id: string, c: Record<string, unknown>) {
  await avaliacaoDoRecibo(quem, id);
  await exigirNaoPago(id);
  const assinatura = typeof c.assinatura === "string" ? c.assinatura : "";
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(assinatura) || assinatura.length > ASSINATURA_MAX) {
    throw new ErroCO(400, "Assinatura inválida. Assine de novo no quadro.");
  }
  const { rows: [r] } = await q(`select * from co_recibos where avaliacao_id = $1`, [id]);
  const faltando: string[] = [];
  if (!r?.nome_completo) faltando.push("nome completo");
  if (!r?.telefone || String(r.telefone).length < 10) faltando.push("telefone com DDD");
  if (!r?.cpf || !cpfValido(r.cpf)) faltando.push("CPF válido");
  if (!r?.chave_pix_tipo || !r?.chave_pix) faltando.push("chave PIX");
  if (!r?.quantidade_pesquisas) faltando.push("quantidade de pesquisas");
  if (!r?.valor_unitario_centavos) faltando.push("valor unitário");
  if (faltando.length) throw new ErroCO(400, `Preencha antes de assinar: ${faltando.join(", ")}.`);
  await q(
    `update co_recibos set assinatura = $2, assinado_em = now(), atualizado_em = now() where avaliacao_id = $1`,
    [id, assinatura],
  );
  return obterRecibo(quem, id);
}

/** Coordenador de Market Share / administrador marca o recibo assinado como pago. */
export async function marcarReciboPago(quem: Quem, id: string, pago: boolean) {
  await avaliacaoDoRecibo(quem, id);
  const { rows: [r] } = await q(`select assinado_em from co_recibos where avaliacao_id = $1`, [id]);
  if (!r?.assinado_em) throw new ErroCO(409, "O recibo ainda não foi assinado pelo Cliente Oculto.");
  await q(
    `update co_recibos set pago_em = ${pago ? "now()" : "null"}, pago_por = $2, atualizado_em = now() where avaliacao_id = $1`,
    [id, pago ? quem.id_usuario : null],
  );
  return obterRecibo(quem, id);
}

export type StatusRecibo = "nao_assinado" | "aguardando_pagamento" | "pago";

export interface LinhaRecibo {
  avaliacaoId: string;
  avaliador: string | null;
  empreendimento: string | null;
  dataVisita: string | null;
  quantidade: number | null;
  valorCentavos: number | null;
  assinadoEm: string | null;
  pagoEm: string | null;
  status: StatusRecibo;
}

/**
 * Tela de recibos (administrador): todas as avaliações já enviadas pelo
 * Cliente Oculto, com o recibo (ou a falta dele). Filtro por mês da visita.
 */
export async function listarRecibos(f: { status?: string; mes?: string }): Promise<LinhaRecibo[]> {
  const params: unknown[] = [];
  let sql = `
    select a.id, coalesce(r.nome_completo, a.cliente_oculto_nome) as avaliador, a.empreendimento_texto,
           to_char(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date), 'YYYY-MM-DD') as data_visita,
           r.quantidade_pesquisas, r.valor_centavos, r.assinado_em, r.pago_em
      from co_avaliacoes a
      left join co_recibos r on r.avaliacao_id = a.id
     where not a.excluida and a.status <> 'Em Preenchimento'`;
  if (f.mes && /^\d{4}-\d{2}$/.test(f.mes)) {
    params.push(f.mes);
    sql += ` and to_char(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date), 'YYYY-MM') = $${params.length}`;
  }
  sql += " order by a.data_visita desc nulls last, a.id desc";
  const { rows } = await q(sql, params);
  const linhas: LinhaRecibo[] = rows.map((r) => ({
    avaliacaoId: r.id,
    avaliador: r.avaliador,
    empreendimento: r.empreendimento_texto,
    dataVisita: r.data_visita,
    quantidade: r.quantidade_pesquisas,
    valorCentavos: r.valor_centavos === null ? null : Number(r.valor_centavos),
    assinadoEm: r.assinado_em ? new Date(r.assinado_em).toISOString() : null,
    pagoEm: r.pago_em ? new Date(r.pago_em).toISOString() : null,
    status: r.pago_em ? "pago" : r.assinado_em ? "aguardando_pagamento" : "nao_assinado",
  }));
  return f.status ? linhas.filter((l) => l.status === f.status) : linhas;
}
