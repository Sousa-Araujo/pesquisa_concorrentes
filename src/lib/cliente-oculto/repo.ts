/**
 * Camada de dados do Cliente Oculto — porte do `db/db.js` do app antigo
 * (Sousa-Araujo/hidden) para as tabelas `co_*` do sistema unificado.
 *
 * Mantém o formato JSON que as telas antigas esperam (camelCase), para
 * que elas rodem sem mudança. Diferenças em relação ao app antigo:
 *   - cada avaliação tem dono (`avaliador_id`); o avaliador só vê e edita
 *     as próprias;
 *   - para o avaliador, a leitura esconde nota calibrada, justificativa,
 *     override da jornada e mapa de gaps (antes a tela escondia, mas a API
 *     entregava);
 *   - o Coordenador pode trocar Sousa x Concorrente pela rota de vínculo
 *     (antes a tela chamava uma rota só de admin e falhava).
 */
import "server-only";
import { db } from "@/lib/db/pool";

export const PILAR_KEYS = ["recepcao", "corretorAtend", "pdv", "materiais", "negociacao", "conhecimento"] as const;
export const JORNADA_KEYS = [
  "recepcaoTriagem", "apresentacaoProduto", "decoradoMaquete",
  "simulacao", "negociacaoEtapa", "fechamento", "followup",
] as const;
export const STATUS = {
  PREENCHIMENTO: "Em Preenchimento",
  AGUARDANDO: "Aguardando Calibragem",
  CONCLUIDA: "Concluída",
} as const;
const STATUS_VALIDOS: string[] = Object.values(STATUS);
const GRAVIDADES = ["baixa", "moderada", "alta", "critica"];
const STATUS_JORNADA = ["realizada", "parcial", "nao_realizada", "na"];

/** Papel no módulo Cliente Oculto, derivado dos perfis unificados. */
export type PapelCO = "avaliador" | "coordenador" | "admin";

export interface Quem {
  id_usuario: string;
  papel: PapelCO;
}

export function papelCO(perfis: readonly string[]): PapelCO | null {
  if (perfis.includes("admin")) return "admin";
  if (perfis.includes("coordenador_market_share")) return "coordenador";
  if (perfis.includes("avaliador")) return "avaliador";
  return null;
}

export class ErroCO extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

type Linha = Record<string, unknown>;
type Campos = Record<string, unknown>;

const q = (texto: string, params: unknown[] = []) => db().query(texto, params);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// ---------------------------------------------------------------------------
// Campos de identificação: nome usado pelas telas → coluna.
// ---------------------------------------------------------------------------
const IDENTIFICACAO: Record<string, string> = {
  empreendimento: "empreendimento_texto", regional: "regional", dataVisita: "data_visita",
  horario: "horario", clienteOculto: "cliente_oculto_nome", recepcionista: "recepcionista",
  corretor: "corretor", areaUnidadeM2: "area_unidade_m2", areaUnidadeDisplay: "area_unidade_display",
  valorUnidadeCentavos: "valor_unidade_centavos", valorUnidadeDisplay: "valor_unidade_display",
  valorAtoCentavos: "valor_ato_centavos", valorAtoDisplay: "valor_ato_display",
  qtdPreChaves: "qtd_pre_chaves", qtdPosChaves: "qtd_pos_chaves", descontoTipo: "desconto_tipo",
  descontoValorCentavos: "desconto_valor_centavos", descontoPercentual: "desconto_percentual",
  descontoDisplay: "desconto_display", previsaoEntrega: "previsao_entrega", campanhaVigente: "campanha_vigente",
  tipoEmpreendimento: "tipo_empreendimento", construtora: "construtora_texto",
  vinculoSousaId: "vinculo_sousa_id", vinculoSousaLabel: "vinculo_sousa_label",
};

/** Normaliza o valor vindo da tela antes de gravar (string vazia em data/número vira null). */
function valorColuna(coluna: string, v: unknown): unknown {
  if (v === undefined) return null;
  if (v === "" && (coluna === "data_visita" || coluna === "vinculo_sousa_id" || coluna.endsWith("_centavos")
    || coluna === "area_unidade_m2" || coluna === "desconto_percentual" || coluna === "desconto_tipo")) return null;
  return v;
}

function mesReferencia(dataVisita: unknown): string | null {
  const m = String(dataVisita ?? "").match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
function linhaParaAvaliacao(r: Linha) {
  return {
    id: r.id,
    status: r.status,
    createdAt: r.criada_em,
    updatedAt: r.atualizada_em,
    finalizedAt: r.finalizada_em,
    concludedAt: r.concluida_em,
    calibragemAberta: !!r.calibragem_aberta,
    excluida: !!r.excluida,
    excluidaEm: r.excluida_em,
    vinculoSousaId: r.vinculo_sousa_id,
    vinculoSousaLabel: r.vinculo_sousa_label,
    identificacao: {
      empreendimento: r.empreendimento_texto,
      regional: r.regional,
      dataVisita: r.data_visita,
      horario: r.horario,
      clienteOculto: r.cliente_oculto_nome,
      recepcionista: r.recepcionista,
      corretor: r.corretor,
      areaUnidadeM2: num(r.area_unidade_m2),
      areaUnidadeDisplay: r.area_unidade_display,
      valorUnidadeCentavos: num(r.valor_unidade_centavos),
      valorUnidadeDisplay: r.valor_unidade_display,
      valorAtoCentavos: num(r.valor_ato_centavos),
      valorAtoDisplay: r.valor_ato_display,
      qtdPreChaves: r.qtd_pre_chaves,
      qtdPosChaves: r.qtd_pos_chaves,
      descontoTipo: r.desconto_tipo,
      descontoValorCentavos: num(r.desconto_valor_centavos),
      descontoPercentual: num(r.desconto_percentual),
      descontoDisplay: r.desconto_display,
      previsaoEntrega: r.previsao_entrega,
      campanhaVigente: r.campanha_vigente,
      tipoEmpreendimento: r.tipo_empreendimento,
      construtora: r.construtora_texto,
    },
  };
}

type Avaliacao = ReturnType<typeof linhaParaAvaliacao> & {
  pilares: Record<string, unknown>;
  jornada: Record<string, unknown>;
  gaps: unknown[];
};

async function carregarAvaliacao(id: string): Promise<Avaliacao | null> {
  const { rows } = await q(`select * from co_avaliacoes where id = $1`, [id]);
  if (!rows[0]) return null;
  const av = linhaParaAvaliacao(rows[0]) as Avaliacao;

  const { rows: pilares } = await q(`select * from co_pilares where avaliacao_id = $1`, [id]);
  av.pilares = {};
  for (const k of PILAR_KEYS) {
    const p = pilares.find((x) => x.pilar_key === k);
    av.pilares[k] = p
      ? {
          avaliado: !!p.avaliado, notaInformada: num(p.nota_informada), evidencia: p.evidencia,
          notaCalibrada: num(p.nota_calibrada), justificativaCalibragem: p.justificativa_calibragem,
        }
      : { avaliado: true, notaInformada: null, evidencia: "", notaCalibrada: null, justificativaCalibragem: "" };
  }

  const { rows: jornada } = await q(`select * from co_jornada where avaliacao_id = $1`, [id]);
  av.jornada = {};
  for (const k of JORNADA_KEYS) {
    const j = jornada.find((x) => x.etapa_key === k);
    av.jornada[k] = { status: j ? j.status : "realizada", statusCalibrado: j ? j.status_calibrado : null };
  }

  const { rows: gaps } = await q(`select * from co_gaps where avaliacao_id = $1 order by criado_em, id`, [id]);
  av.gaps = gaps.map((g) => ({
    id: g.id, gap: g.gap, pilarRelacionado: g.pilar_relacionado,
    evidencia: g.evidencia, gravidade: g.gravidade, createdAt: g.criado_em,
  }));
  return av;
}

/** O avaliador nunca recebe a camada analítica do Coordenador. */
function visaoAvaliador(av: Avaliacao): Avaliacao {
  const pilares: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(av.pilares)) {
    const { avaliado, notaInformada, evidencia } = p as Record<string, unknown>;
    pilares[k] = { avaliado, notaInformada, evidencia, notaCalibrada: null, justificativaCalibragem: "" };
  }
  const jornada: Record<string, unknown> = {};
  for (const [k, j] of Object.entries(av.jornada)) {
    jornada[k] = { status: (j as Record<string, unknown>).status, statusCalibrado: null };
  }
  return { ...av, pilares, jornada, gaps: [] };
}

async function donoDe(id: string): Promise<{ avaliador_id: string | null } | null> {
  const { rows } = await q(`select avaliador_id from co_avaliacoes where id = $1`, [id]);
  return (rows[0] as { avaliador_id: string | null }) ?? null;
}

/** Avaliador só acessa avaliações que ele mesmo criou. */
async function exigirAcesso(quem: Quem, id: string): Promise<void> {
  const dono = await donoDe(id);
  if (!dono) throw new ErroCO(404, "Avaliação não encontrada");
  if (quem.papel === "avaliador" && dono.avaliador_id !== quem.id_usuario) {
    throw new ErroCO(404, "Avaliação não encontrada");
  }
}

export async function obterAvaliacao(quem: Quem, id: string): Promise<Avaliacao> {
  await exigirAcesso(quem, id);
  const av = (await carregarAvaliacao(id))!;
  return quem.papel === "avaliador" ? visaoAvaliador(av) : av;
}

export async function listarAvaliacoes(quem: Quem, f: Record<string, string | undefined>) {
  let sql = `
    select a.*,
      (select avg(p.nota_calibrada) from co_pilares p
        where p.avaliacao_id = a.id and p.avaliado and p.nota_calibrada is not null) as nota_geral_calibrada,
      (select count(*) from co_pilares p where p.avaliacao_id = a.id and p.avaliado) as pilares_avaliados,
      (select count(*) from co_gaps g where g.avaliacao_id = a.id) as total_gaps,
      (select count(*) from co_gaps g where g.avaliacao_id = a.id and g.gravidade in ('alta','critica')) as gaps_alta_critica
    from co_avaliacoes a where true`;
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (quem.papel === "avaliador") sql += ` and a.avaliador_id = ${p(quem.id_usuario)}`;
  if (!["true", "1"].includes(f.includeExcluidas ?? "")) sql += " and not a.excluida";
  if (f.status) sql += ` and a.status = ${p(f.status)}`;
  if (f.regional) sql += ` and a.regional = ${p(f.regional)}`;
  if (f.tipoEmpreendimento) sql += ` and a.tipo_empreendimento = ${p(f.tipoEmpreendimento)}`;
  if (f.empreendimento) sql += ` and a.empreendimento_texto ilike ${p(`%${f.empreendimento}%`)}`;
  if (f.mes && /^\d{4}-\d{2}$/.test(f.mes)) sql += ` and to_char(a.data_visita, 'YYYY-MM') = ${p(f.mes)}`;
  if (f.q) {
    const t = p(`%${f.q}%`);
    sql += ` and (a.empreendimento_texto ilike ${t} or a.corretor ilike ${t} or a.cliente_oculto_nome ilike ${t} or a.id ilike ${t})`;
  }
  sql += " order by a.criada_em desc";
  const { rows } = await q(sql, params);
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    empreendimento: r.empreendimento_texto,
    regional: r.regional,
    dataVisita: r.data_visita,
    mesReferencia: mesReferencia(r.data_visita),
    clienteOculto: r.cliente_oculto_nome,
    corretor: r.corretor,
    createdAt: r.criada_em,
    notaGeralCalibrada: quem.papel === "avaliador" ? null : num(r.nota_geral_calibrada),
    pilaresAvaliados: Number(r.pilares_avaliados),
    totalGaps: quem.papel === "avaliador" ? 0 : Number(r.total_gaps),
    gapsAltaCritica: quem.papel === "avaliador" ? 0 : Number(r.gaps_alta_critica),
    tipoEmpreendimento: r.tipo_empreendimento,
    construtora: r.construtora_texto,
    vinculoSousaId: r.vinculo_sousa_id,
    vinculoSousaLabel: r.vinculo_sousa_label,
    calibragemAberta: !!r.calibragem_aberta,
    excluida: !!r.excluida,
    excluidaEm: r.excluida_em,
  }));
}

// ---------------------------------------------------------------------------
// Criação e etapa 1 (Avaliador)
// ---------------------------------------------------------------------------
export async function criarAvaliacao(quem: Quem) {
  const client = await db().connect();
  try {
    await client.query("begin");
    const ano = new Date().getFullYear();
    await client.query(`insert into co_id_contadores (ano, proximo) values ($1, 1) on conflict (ano) do nothing`, [ano]);
    const { rows } = await client.query<{ usado: number }>(
      `update co_id_contadores set proximo = proximo + 1 where ano = $1 returning proximo - 1 as usado`,
      [ano],
    );
    const id = `CO-${ano}-${String(rows[0].usado).padStart(4, "0")}`;
    await client.query(`insert into co_avaliacoes (id, avaliador_id) values ($1, $2)`, [id, quem.id_usuario]);
    for (const k of PILAR_KEYS) {
      await client.query(`insert into co_pilares (avaliacao_id, pilar_key, avaliado) values ($1, $2, true)`, [id, k]);
    }
    for (const k of JORNADA_KEYS) {
      await client.query(`insert into co_jornada (avaliacao_id, etapa_key, status) values ($1, $2, 'realizada')`, [id, k]);
    }
    await client.query("commit");
    return obterAvaliacao(quem, id);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

async function exigirStatus(id: string, permitidos: string[]) {
  const { rows } = await q(`select status from co_avaliacoes where id = $1`, [id]);
  if (!rows[0]) throw new ErroCO(404, "Avaliação não encontrada");
  if (!permitidos.includes(rows[0].status)) {
    throw new ErroCO(409, `Ação não permitida para o status atual (${rows[0].status}).`);
  }
}

/**
 * Avaliador edita enquanto está "Em Preenchimento" e, depois de finalizar,
 * até o Coordenador abrir a calibragem.
 */
async function exigirEditavelPeloAvaliador(quem: Quem, id: string) {
  await exigirAcesso(quem, id);
  const { rows } = await q(`select status, calibragem_aberta from co_avaliacoes where id = $1`, [id]);
  const r = rows[0];
  const pode = r.status === STATUS.PREENCHIMENTO || (r.status === STATUS.AGUARDANDO && !r.calibragem_aberta);
  if (!pode) throw new ErroCO(409, "Esta avaliação já está em calibragem e não pode mais ser editada pelo Cliente Oculto.");
}

async function gravarIdentificacao(id: string, campos: Campos) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(campos ?? {})) {
    const coluna = IDENTIFICACAO[k];
    if (!coluna) continue;
    params.push(valorColuna(coluna, v));
    sets.push(`${coluna} = $${params.length}`);
  }
  if (!sets.length) return;
  params.push(id);
  try {
    await q(`update co_avaliacoes set ${sets.join(", ")} where id = $${params.length}`, params);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "22007" || code === "22P02" || code === "23514") throw new ErroCO(400, "Valor inválido em um dos campos.");
    if (code === "23503") throw new ErroCO(400, "Vínculo com avaliação Sousa inválido.");
    throw e;
  }
}

export async function atualizarIdentificacao(quem: Quem, id: string, campos: Campos) {
  await exigirEditavelPeloAvaliador(quem, id);
  await gravarIdentificacao(id, campos);
  return obterAvaliacao(quem, id);
}

function nota(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new ErroCO(400, "Nota deve estar entre 0 e 10.");
  return n;
}

function exigirPilar(k: string) {
  if (!(PILAR_KEYS as readonly string[]).includes(k)) throw new ErroCO(400, "Pilar inválido");
}
function exigirEtapa(k: string) {
  if (!(JORNADA_KEYS as readonly string[]).includes(k)) throw new ErroCO(400, "Etapa inválida");
}
function exigirStatusJornada(s: unknown, permiteVazio = false) {
  if (permiteVazio && (s === null || s === undefined || s === "")) return;
  if (!STATUS_JORNADA.includes(String(s))) throw new ErroCO(400, "Status da etapa inválido.");
}

export async function atualizarPilarInformada(quem: Quem, id: string, pilar: string, c: Campos) {
  await exigirEditavelPeloAvaliador(quem, id);
  exigirPilar(pilar);
  await q(
    `update co_pilares set avaliado = $1, nota_informada = $2, evidencia = $3 where avaliacao_id = $4 and pilar_key = $5`,
    [!!c.avaliado, nota(c.notaInformada), c.evidencia ?? "", id, pilar],
  );
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function atualizarJornada(quem: Quem, id: string, etapa: string, status: unknown) {
  await exigirEditavelPeloAvaliador(quem, id);
  exigirEtapa(etapa);
  exigirStatusJornada(status);
  await q(`update co_jornada set status = $1 where avaliacao_id = $2 and etapa_key = $3`, [status, id, etapa]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function finalizar(quem: Quem, id: string) {
  await exigirAcesso(quem, id);
  await exigirStatus(id, [STATUS.PREENCHIMENTO]);
  await q(`update co_avaliacoes set status = $1, finalizada_em = now() where id = $2`, [STATUS.AGUARDANDO, id]);
  return obterAvaliacao(quem, id);
}

// ---------------------------------------------------------------------------
// Vínculo Sousa x Concorrente
// ---------------------------------------------------------------------------
export async function opcoesVinculo(quem: Quem, id: string) {
  await exigirAcesso(quem, id);
  const { rows: [av] } = await q(`select regional, data_visita from co_avaliacoes where id = $1`, [id]);
  const mes = mesReferencia(av.data_visita);
  let sql = `select id, empreendimento_texto, data_visita from co_avaliacoes
              where tipo_empreendimento = 'sousa' and not excluida and id <> $1`;
  const params: unknown[] = [id];
  if (av.regional) { params.push(av.regional); sql += ` and regional = $${params.length}`; }
  sql += " order by data_visita desc nulls last";
  const { rows } = await q(sql, params);
  return rows
    .filter((r) => !mes || mesReferencia(r.data_visita) === mes)
    .map((r) => ({ id: r.id, label: `${r.empreendimento_texto || r.id} — ${r.data_visita || "s/ data"}` }));
}

export async function concorrentesVinculados(quem: Quem, sousaId: string) {
  if (quem.papel === "avaliador") throw new ErroCO(403, "Você não tem permissão para executar esta ação.");
  const { rows } = await q(
    `select id from co_avaliacoes
      where tipo_empreendimento = 'concorrente' and vinculo_sousa_id = $1 and not excluida
      order by criada_em`,
    [sousaId],
  );
  const lista = [];
  for (const r of rows) lista.push(await carregarAvaliacao(r.id));
  return lista;
}

/** Coordenador corrige o vínculo (e o tipo Sousa/Concorrente) durante a calibragem. */
export async function atualizarVinculoCoord(quem: Quem, id: string, c: Campos) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  const campos: Campos = {};
  if (c.tipoEmpreendimento !== undefined) {
    if (!["sousa", "concorrente"].includes(String(c.tipoEmpreendimento))) throw new ErroCO(400, "Tipo inválido.");
    campos.tipoEmpreendimento = c.tipoEmpreendimento;
  }
  if (c.vinculoSousaId !== undefined) campos.vinculoSousaId = c.vinculoSousaId || null;
  if (c.vinculoSousaLabel !== undefined) campos.vinculoSousaLabel = c.vinculoSousaLabel || null;
  await gravarIdentificacao(id, campos);
  return obterAvaliacao(quem, id);
}

// ---------------------------------------------------------------------------
// Etapa 2 (Coordenador de Market Share)
// ---------------------------------------------------------------------------
export async function abrirCalibragem(quem: Quem, id: string) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  await q(`update co_avaliacoes set calibragem_aberta = true where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function atualizarCalibragem(quem: Quem, id: string, pilar: string, c: Campos) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  exigirPilar(pilar);
  await q(
    `update co_pilares set nota_calibrada = $1, justificativa_calibragem = $2 where avaliacao_id = $3 and pilar_key = $4`,
    [nota(c.notaCalibrada), c.justificativaCalibragem ?? "", id, pilar],
  );
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function atualizarJornadaCalibrada(quem: Quem, id: string, etapa: string, statusCalibrado: unknown) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  exigirEtapa(etapa);
  exigirStatusJornada(statusCalibrado, true);
  await q(`update co_jornada set status_calibrado = $1 where avaliacao_id = $2 and etapa_key = $3`,
    [statusCalibrado || null, id, etapa]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

function validarGap(c: Campos) {
  const gap = String(c.gap ?? "").trim();
  const evidencia = String(c.evidencia ?? "").trim();
  if (!gap) throw new ErroCO(400, "Descreva o gap identificado.");
  if (!GRAVIDADES.includes(String(c.gravidade))) throw new ErroCO(400, "Gravidade inválida.");
  if (!evidencia) throw new ErroCO(400, "Todo gap precisa de uma evidência.");
  return { gap, evidencia, gravidade: String(c.gravidade), pilar: (c.pilarRelacionado as string) || "outro" };
}

async function inserirGap(quem: Quem, id: string, c: Campos) {
  const g = validarGap(c);
  await q(
    `insert into co_gaps (avaliacao_id, gap, pilar_relacionado, evidencia, gravidade, criado_por)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, g.gap, g.pilar, g.evidencia, g.gravidade, quem.id_usuario],
  );
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
}

export async function adicionarGap(quem: Quem, id: string, c: Campos) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  await inserirGap(quem, id, c);
  return obterAvaliacao(quem, id);
}

export async function removerGap(quem: Quem, id: string, gapId: number) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  await q(`delete from co_gaps where id = $1 and avaliacao_id = $2`, [gapId, id]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function concluir(quem: Quem, id: string) {
  await exigirStatus(id, [STATUS.AGUARDANDO]);
  await q(`update co_avaliacoes set status = $1, concluida_em = now() where id = $2`, [STATUS.CONCLUIDA, id]);
  return obterAvaliacao(quem, id);
}

// ---------------------------------------------------------------------------
// Administrador — exclusão lógica e correções sem trava de status
// ---------------------------------------------------------------------------
async function exigirExiste(id: string) {
  if (!(await donoDe(id))) throw new ErroCO(404, "Avaliação não encontrada");
}

export async function excluir(quem: Quem, id: string) {
  await exigirExiste(id);
  await q(`update co_avaliacoes set excluida = true, excluida_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function restaurar(quem: Quem, id: string) {
  await exigirExiste(id);
  await q(`update co_avaliacoes set excluida = false, excluida_em = null where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarIdentificacao(quem: Quem, id: string, campos: Campos) {
  await exigirExiste(id);
  await gravarIdentificacao(id, campos);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarPilar(quem: Quem, id: string, pilar: string, c: Campos) {
  exigirPilar(pilar);
  const { rows: [atual] } = await q(`select * from co_pilares where avaliacao_id = $1 and pilar_key = $2`, [id, pilar]);
  if (!atual) throw new ErroCO(404, "Avaliação não encontrada");
  await q(
    `update co_pilares set avaliado = $1, nota_informada = $2, evidencia = $3, nota_calibrada = $4, justificativa_calibragem = $5
      where avaliacao_id = $6 and pilar_key = $7`,
    [
      c.avaliado === undefined ? atual.avaliado : !!c.avaliado,
      c.notaInformada === undefined ? atual.nota_informada : nota(c.notaInformada),
      c.evidencia === undefined ? atual.evidencia : c.evidencia,
      c.notaCalibrada === undefined ? atual.nota_calibrada : nota(c.notaCalibrada),
      c.justificativaCalibragem === undefined ? atual.justificativa_calibragem : c.justificativaCalibragem,
      id, pilar,
    ],
  );
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarJornada(quem: Quem, id: string, etapa: string, c: Campos) {
  exigirEtapa(etapa);
  const { rows: [atual] } = await q(`select * from co_jornada where avaliacao_id = $1 and etapa_key = $2`, [id, etapa]);
  if (!atual) throw new ErroCO(404, "Avaliação não encontrada");
  if (c.status !== undefined) exigirStatusJornada(c.status);
  if (c.statusCalibrado !== undefined) exigirStatusJornada(c.statusCalibrado, true);
  await q(`update co_jornada set status = $1, status_calibrado = $2 where avaliacao_id = $3 and etapa_key = $4`, [
    c.status === undefined ? atual.status : c.status,
    c.statusCalibrado === undefined ? atual.status_calibrado : c.statusCalibrado || null,
    id, etapa,
  ]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function adminAdicionarGap(quem: Quem, id: string, c: Campos) {
  await exigirExiste(id);
  await inserirGap(quem, id, c);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarGap(quem: Quem, id: string, gapId: number, c: Campos) {
  const { rows: [atual] } = await q(`select * from co_gaps where id = $1 and avaliacao_id = $2`, [gapId, id]);
  if (!atual) throw new ErroCO(404, "Gap não encontrado");
  if (c.gravidade !== undefined && !GRAVIDADES.includes(String(c.gravidade))) throw new ErroCO(400, "Gravidade inválida.");
  await q(`update co_gaps set gap = $1, pilar_relacionado = $2, evidencia = $3, gravidade = $4 where id = $5 and avaliacao_id = $6`, [
    c.gap === undefined ? atual.gap : String(c.gap).trim(),
    c.pilarRelacionado === undefined ? atual.pilar_relacionado : c.pilarRelacionado,
    c.evidencia === undefined ? atual.evidencia : String(c.evidencia).trim(),
    c.gravidade === undefined ? atual.gravidade : c.gravidade,
    gapId, id,
  ]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function adminRemoverGap(quem: Quem, id: string, gapId: number) {
  await q(`delete from co_gaps where id = $1 and avaliacao_id = $2`, [gapId, id]);
  await q(`update co_avaliacoes set atualizada_em = now() where id = $1`, [id]);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarStatus(quem: Quem, id: string, status: unknown) {
  if (!STATUS_VALIDOS.includes(String(status))) throw new ErroCO(400, "Status inválido");
  await exigirExiste(id);
  const extra =
    status === STATUS.AGUARDANDO ? ", finalizada_em = coalesce(finalizada_em, now())"
    : status === STATUS.CONCLUIDA ? ", concluida_em = coalesce(concluida_em, now())" : "";
  await q(`update co_avaliacoes set status = $1${extra} where id = $2`, [status, id]);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarCalibragemAberta(quem: Quem, id: string, aberta: boolean) {
  await exigirExiste(id);
  await q(`update co_avaliacoes set calibragem_aberta = $1 where id = $2`, [aberta, id]);
  return obterAvaliacao(quem, id);
}

export async function adminAtualizarVinculo(quem: Quem, id: string, c: Campos) {
  await exigirExiste(id);
  const campos: Campos = {};
  for (const k of ["tipoEmpreendimento", "vinculoSousaId", "vinculoSousaLabel", "construtora"]) {
    if (c[k] !== undefined) campos[k] = c[k] === "" ? null : c[k];
  }
  await gravarIdentificacao(id, campos);
  return obterAvaliacao(quem, id);
}
