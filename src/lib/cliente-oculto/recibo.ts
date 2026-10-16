/**
 * Recibo de pagamento do Cliente Oculto (avaliador).
 * O avaliador informa nome, CPF, chave PIX, valor e cidade e assina na tela;
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
    `select id, avaliador_id, empreendimento_texto, data_visita, cliente_oculto_nome, somente_previa
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
      clienteOculto: a.cliente_oculto_nome,
      somentePrevia: !!a.somente_previa,
    },
    recibo: {
      nomeCompleto: r?.nome_completo ?? "",
      cpf: r?.cpf ?? "",
      chavePixTipo: r?.chave_pix_tipo ?? "",
      chavePix: r?.chave_pix ?? "",
      valorCentavos: r?.valor_centavos === null || r?.valor_centavos === undefined ? null : Number(r.valor_centavos),
      cidade: r?.cidade ?? "",
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
  let valor: number | null = null;
  if (c.valorCentavos !== undefined && c.valorCentavos !== null && c.valorCentavos !== "") {
    valor = Number(c.valorCentavos);
    if (!Number.isInteger(valor) || valor <= 0) throw new ErroCO(400, "Valor inválido.");
  }
  await q(
    `insert into co_recibos (avaliacao_id, nome_completo, cpf, chave_pix_tipo, chave_pix, valor_centavos, cidade)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (avaliacao_id) do update set
       nome_completo = excluded.nome_completo, cpf = excluded.cpf, chave_pix_tipo = excluded.chave_pix_tipo,
       chave_pix = excluded.chave_pix, valor_centavos = excluded.valor_centavos, cidade = excluded.cidade,
       assinatura = null, assinado_em = null, atualizado_em = now()`,
    [id, texto(c.nomeCompleto), cpf, tipo, texto(c.chavePix), valor, texto(c.cidade)],
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
  if (!r?.cpf || !cpfValido(r.cpf)) faltando.push("CPF válido");
  if (!r?.chave_pix_tipo || !r?.chave_pix) faltando.push("chave PIX");
  if (!r?.valor_centavos) faltando.push("valor");
  if (!r?.cidade) faltando.push("cidade");
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
