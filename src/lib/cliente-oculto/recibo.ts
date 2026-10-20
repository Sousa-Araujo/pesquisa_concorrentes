/**
 * Recibo de pagamento do Cliente Oculto (avaliador) — um recibo por avaliador.
 * O recibo aberto reúne todas as visitas enviadas que ainda não estão em um
 * recibo assinado; o avaliador digita o valor de cada visita (o total é a
 * soma), informa nome, telefone, CPF e chave PIX e assina na tela. Depois de
 * assinado, as próximas visitas vão para um novo recibo. O Coordenador de
 * Market Share (ou o administrador) aprova ou devolve para correção e, depois
 * de aprovado, marca como pago. Mudar qualquer dado de um recibo assinado
 * apaga a assinatura e a aprovação.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { ErroCO, type Quem } from "./repo";
import { cpfValido } from "@/lib/domain/cpf";

const q = (texto: string, params: unknown[] = []) => db().query(texto, params);

const TIPOS_PIX = ["cpf", "celular", "email", "aleatoria"] as const;
/** Assinatura em PNG feita no navegador; um traço na tela fica bem abaixo disso. */
const ASSINATURA_MAX = 300_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coloca as visitas enviadas sem recibo no recibo aberto do avaliador (cria
 * um, com os dados do PIX do recibo anterior, se não houver). Sem avaliador,
 * faz para todos — usado pela tela de recibos do administrador.
 */
export async function sincronizarRecibos(avaliadorId?: string) {
  const filtro = avaliadorId ? "and a.avaliador_id = $1" : "";
  const params = avaliadorId ? [avaliadorId] : [];
  const pendentes = `
    select a.id, a.avaliador_id from co_avaliacoes a
     where not a.excluida and a.status <> 'Em Preenchimento' and a.avaliador_id is not null ${filtro}
       and not exists (select 1 from co_recibo_visitas v where v.avaliacao_id = a.id)`;
  await q(
    `insert into co_recibos_avaliador (avaliador_id, nome_completo, telefone, cpf, chave_pix_tipo, chave_pix)
     select p.avaliador_id, coalesce(ant.nome_completo, u.nome), ant.telefone, ant.cpf, ant.chave_pix_tipo, ant.chave_pix
       from (select distinct avaliador_id from (${pendentes}) x) p
       join usuarios u on u.id_usuario = p.avaliador_id
       left join lateral (select * from co_recibos_avaliador r where r.avaliador_id = p.avaliador_id
                           order by r.criado_em desc limit 1) ant on true
      where not exists (select 1 from co_recibos_avaliador o
                         where o.avaliador_id = p.avaliador_id and o.assinado_em is null and o.pago_em is null)`,
    params,
  );
  await q(
    `insert into co_recibo_visitas (recibo_id, avaliacao_id)
     select (select o.id from co_recibos_avaliador o
              where o.avaliador_id = p.avaliador_id and o.assinado_em is null and o.pago_em is null
              order by o.criado_em desc limit 1), p.id
       from (${pendentes}) p
     on conflict do nothing`,
    params,
  );
}

async function reciboDoUsuario(quem: Quem, id: string) {
  if (!UUID.test(id)) throw new ErroCO(404, "Recibo não encontrado");
  const { rows: [r] } = await q(`select * from co_recibos_avaliador where id = $1`, [id]);
  if (!r || (quem.papel === "avaliador" && r.avaliador_id !== quem.id_usuario)) throw new ErroCO(404, "Recibo não encontrado");
  return r;
}

const dataDaVisita = `to_char(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date), 'YYYY-MM-DD')`;

async function paraTela(r: Record<string, unknown>) {
  const { rows: visitas } = await q(
    `select a.id, a.empreendimento_texto, ${dataDaVisita} as data_visita, a.horario, a.somente_previa,
            a.previa_contato_em, v.valor_centavos
       from co_recibo_visitas v join co_avaliacoes a on a.id = v.avaliacao_id
      where v.recibo_id = $1
      order by coalesce(a.data_visita, left(a.previa_contato_em, 10)::date), a.id`,
    [r.id],
  );
  const lista = visitas.map((v) => ({
    avaliacaoId: v.id,
    empreendimento: v.empreendimento_texto,
    dataVisita: v.data_visita,
    horario: v.somente_previa && v.previa_contato_em ? String(v.previa_contato_em).slice(11, 16) : v.horario,
    somentePrevia: !!v.somente_previa,
    valorCentavos: v.valor_centavos === null ? null : Number(v.valor_centavos),
  }));
  const total = lista.reduce((s, v) => s + (v.valorCentavos ?? 0), 0);
  const { rows: historico } = await q(
    `select r.id, r.criado_em, r.assinado_em, r.pago_em, count(v.avaliacao_id)::int as visitas,
            coalesce(sum(v.valor_centavos), 0)::bigint as total
       from co_recibos_avaliador r left join co_recibo_visitas v on v.recibo_id = r.id
      where r.avaliador_id = $1 group by r.id order by r.criado_em desc`,
    [r.avaliador_id],
  );
  return {
    recibo: {
      id: r.id,
      nomeCompleto: r.nome_completo ?? "",
      telefone: r.telefone ?? "",
      cpf: r.cpf ?? "",
      chavePixTipo: r.chave_pix_tipo ?? "",
      chavePix: r.chave_pix ?? "",
      valorCentavos: total || null,
      assinatura: r.assinatura ?? null,
      assinadoEm: r.assinado_em ?? null,
      aprovadoEm: r.aprovado_em ?? null,
      pagoEm: r.pago_em ?? null,
      devolvidoEm: r.devolvido_em ?? null,
      devolvidoMotivo: r.devolvido_motivo ?? null,
    },
    visitas: lista,
    historico: historico.map((h) => ({
      id: h.id, visitas: h.visitas, totalCentavos: Number(h.total),
      criadoEm: h.criado_em, assinadoEm: h.assinado_em, pagoEm: h.pago_em,
    })),
  };
}

/** Recibo que o avaliador vê ao abrir a tela: o aberto, ou o último. */
export async function reciboAtual(quem: Quem) {
  await sincronizarRecibos(quem.id_usuario);
  const { rows: [r] } = await q(
    `select * from co_recibos_avaliador where avaliador_id = $1
      order by (assinado_em is null and pago_em is null) desc, criado_em desc limit 1`,
    [quem.id_usuario],
  );
  if (!r) throw new ErroCO(404, "Você ainda não tem avaliações enviadas para receber.");
  return paraTela(r);
}

export async function obterRecibo(quem: Quem, id: string) {
  return paraTela(await reciboDoUsuario(quem, id));
}

/** O recibo em que está uma avaliação (links da calibragem e do fim do formulário). */
export async function reciboDaAvaliacao(quem: Quem, avaliacaoId: string) {
  const { rows: [a] } = await q(`select avaliador_id from co_avaliacoes where id = $1 and not excluida`, [avaliacaoId]);
  if (!a || (quem.papel === "avaliador" && a.avaliador_id !== quem.id_usuario)) throw new ErroCO(404, "Avaliação não encontrada");
  if (a.avaliador_id) await sincronizarRecibos(a.avaliador_id);
  const { rows: [v] } = await q(`select recibo_id from co_recibo_visitas where avaliacao_id = $1`, [avaliacaoId]);
  if (!v) throw new ErroCO(404, "Esta avaliação ainda não entrou em um recibo (ela precisa ser enviada).");
  return obterRecibo(quem, v.recibo_id);
}

function exigirNaoPago(r: Record<string, unknown>) {
  if (r.pago_em) throw new ErroCO(409, "Este recibo já foi pago e não pode mais ser alterado.");
}

/** Salva dados do PIX e o valor de cada visita. Qualquer mudança apaga a assinatura anterior. */
export async function salvarRecibo(quem: Quem, id: string, c: Record<string, unknown>) {
  const r = await reciboDoUsuario(quem, id);
  exigirNaoPago(r);
  const texto = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);
  const cpf = texto(c.cpf)?.replace(/\D/g, "") || null;
  if (cpf && !/^\d{11}$/.test(cpf)) throw new ErroCO(400, "CPF deve ter 11 números.");
  const tipo = texto(c.chavePixTipo);
  if (tipo && !(TIPOS_PIX as readonly string[]).includes(tipo)) throw new ErroCO(400, "Tipo de chave PIX inválido.");
  const valores = (c.valores && typeof c.valores === "object" ? c.valores : {}) as Record<string, unknown>;
  for (const [avaliacaoId, v] of Object.entries(valores)) {
    if (v !== null && v !== "" && (!Number.isInteger(Number(v)) || Number(v) <= 0)) {
      throw new ErroCO(400, "Valor de visita inválido.");
    }
    await q(
      `update co_recibo_visitas set valor_centavos = $3 where recibo_id = $1 and avaliacao_id = $2`,
      [id, avaliacaoId, v === null || v === "" ? null : Number(v)],
    );
  }
  await q(
    `update co_recibos_avaliador set nome_completo = $2, telefone = $3, cpf = $4, chave_pix_tipo = $5, chave_pix = $6,
            assinatura = null, assinado_em = null, aprovado_em = null, aprovado_por = null, atualizado_em = now()
      where id = $1`,
    [id, texto(c.nomeCompleto), texto(c.telefone)?.replace(/\D/g, "") || null, cpf, tipo, texto(c.chavePix)],
  );
  return obterRecibo(quem, id);
}

/** Assina: exige os dados do PIX, um CPF válido e o valor de todas as visitas. */
export async function assinarRecibo(quem: Quem, id: string, c: Record<string, unknown>) {
  const r = await reciboDoUsuario(quem, id);
  exigirNaoPago(r);
  const assinatura = typeof c.assinatura === "string" ? c.assinatura : "";
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(assinatura) || assinatura.length > ASSINATURA_MAX) {
    throw new ErroCO(400, "Assinatura inválida. Assine de novo no quadro.");
  }
  const { rows: [v] } = await q(
    `select count(*)::int as n, count(*) filter (where valor_centavos is null)::int as sem_valor
       from co_recibo_visitas where recibo_id = $1`,
    [id],
  );
  const faltando: string[] = [];
  if (!r.nome_completo) faltando.push("nome completo");
  if (!r.telefone || String(r.telefone).length < 10) faltando.push("telefone com DDD");
  if (!r.cpf || !cpfValido(r.cpf)) faltando.push("CPF válido");
  if (!r.chave_pix_tipo || !r.chave_pix) faltando.push("chave PIX");
  if (!v.n) faltando.push("ao menos uma visita");
  if (v.sem_valor) faltando.push(v.sem_valor === 1 ? "o valor de 1 visita" : `o valor de ${v.sem_valor} visitas`);
  if (faltando.length) throw new ErroCO(400, `Preencha antes de assinar: ${faltando.join(", ")}.`);
  await q(
    `update co_recibos_avaliador set assinatura = $2, assinado_em = now(), devolvido_em = null, devolvido_motivo = null,
            atualizado_em = now() where id = $1`,
    [id, assinatura],
  );
  return obterRecibo(quem, id);
}

/** Coordenador de Market Share / administrador aprova o recibo assinado (ou desfaz a aprovação). */
export async function aprovarRecibo(quem: Quem, id: string, aprovado: boolean) {
  const r = await reciboDoUsuario(quem, id);
  if (!r.assinado_em) throw new ErroCO(409, "O recibo ainda não foi assinado pelo Cliente Oculto.");
  if (r.pago_em) throw new ErroCO(409, "Este recibo já foi pago.");
  await q(
    `update co_recibos_avaliador set aprovado_em = ${aprovado ? "now()" : "null"}, aprovado_por = $2, atualizado_em = now() where id = $1`,
    [id, aprovado ? quem.id_usuario : null],
  );
  return obterRecibo(quem, id);
}

/**
 * Devolve o recibo ao avaliador para correção: apaga a assinatura e a
 * aprovação e guarda o motivo, que aparece para o avaliador no recibo.
 */
export async function devolverRecibo(quem: Quem, id: string, motivo: unknown) {
  const r = await reciboDoUsuario(quem, id);
  if (r.pago_em) throw new ErroCO(409, "Este recibo já foi pago.");
  const texto = String(motivo ?? "").trim().slice(0, 500);
  if (!texto) throw new ErroCO(400, "Escreva o motivo da devolução.");
  await q(
    `update co_recibos_avaliador set assinatura = null, assinado_em = null, aprovado_em = null, aprovado_por = null,
            devolvido_em = now(), devolvido_motivo = $2, atualizado_em = now() where id = $1`,
    [id, texto],
  );
  return obterRecibo(quem, id);
}

/** Coordenador de Market Share / administrador marca o recibo aprovado como pago. */
export async function marcarReciboPago(quem: Quem, id: string, pago: boolean) {
  const r = await reciboDoUsuario(quem, id);
  if (!r.assinado_em) throw new ErroCO(409, "O recibo ainda não foi assinado pelo Cliente Oculto.");
  if (pago && !r.aprovado_em) throw new ErroCO(409, "Aprove o recibo antes de marcar como pago.");
  await q(
    `update co_recibos_avaliador set pago_em = ${pago ? "now()" : "null"}, pago_por = $2, atualizado_em = now() where id = $1`,
    [id, pago ? quem.id_usuario : null],
  );
  return obterRecibo(quem, id);
}

export type StatusRecibo = "nao_assinado" | "devolvido" | "aguardando_aprovacao" | "aprovado" | "pago";

export interface LinhaRecibo {
  reciboId: string;
  avaliador: string | null;
  empreendimentos: string[];
  visitas: number;
  primeiraVisita: string | null;
  ultimaVisita: string | null;
  valorCentavos: number | null;
  assinadoEm: string | null;
  aprovadoEm: string | null;
  pagoEm: string | null;
  devolvidoMotivo: string | null;
  status: StatusRecibo;
}

/**
 * Tela de recibos (administrador): um recibo por avaliador, com as visitas.
 * Filtro por mês: recibos com alguma visita naquele mês.
 */
export async function listarRecibos(f: { status?: string; mes?: string }): Promise<LinhaRecibo[]> {
  await sincronizarRecibos();
  const params: unknown[] = [];
  let filtroMes = "";
  if (f.mes && /^\d{4}-\d{2}$/.test(f.mes)) {
    params.push(f.mes);
    filtroMes = `having bool_or(to_char(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date), 'YYYY-MM') = $1)`;
  }
  const { rows } = await q(
    `select r.id, coalesce(r.nome_completo, u.nome) as avaliador, r.assinado_em, r.aprovado_em, r.pago_em, r.devolvido_motivo,
            array_agg(distinct a.empreendimento_texto) filter (where a.empreendimento_texto is not null) as empreendimentos,
            count(a.id)::int as visitas,
            to_char(min(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date)), 'YYYY-MM-DD') as primeira,
            to_char(max(coalesce(a.data_visita, left(a.previa_contato_em, 10)::date)), 'YYYY-MM-DD') as ultima,
            sum(v.valor_centavos)::bigint as total
       from co_recibos_avaliador r
       join usuarios u on u.id_usuario = r.avaliador_id
       join co_recibo_visitas v on v.recibo_id = r.id
       join co_avaliacoes a on a.id = v.avaliacao_id
      group by r.id, u.nome ${filtroMes}
      order by (r.pago_em is not null), (r.aprovado_em is not null), r.assinado_em desc nulls last, r.criado_em desc`,
    params,
  );
  const linhas: LinhaRecibo[] = rows.map((r) => ({
    reciboId: r.id,
    avaliador: r.avaliador,
    empreendimentos: r.empreendimentos ?? [],
    visitas: r.visitas,
    primeiraVisita: r.primeira,
    ultimaVisita: r.ultima,
    valorCentavos: r.total === null ? null : Number(r.total),
    assinadoEm: r.assinado_em ? new Date(r.assinado_em).toISOString() : null,
    aprovadoEm: r.aprovado_em ? new Date(r.aprovado_em).toISOString() : null,
    pagoEm: r.pago_em ? new Date(r.pago_em).toISOString() : null,
    devolvidoMotivo: r.devolvido_motivo,
    status: r.pago_em ? "pago" : r.aprovado_em ? "aprovado" : r.assinado_em ? "aguardando_aprovacao"
      : r.devolvido_motivo ? "devolvido" : "nao_assinado",
  }));
  return f.status ? linhas.filter((l) => l.status === f.status) : linhas;
}
