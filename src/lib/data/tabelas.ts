/**
 * Leituras de tabela/espelho (módulo Tabelas e espelhos): guardar o arquivo,
 * pedir a leitura ao Gemini, recalcular na conferência e, na aprovação,
 * gravar estoque/vendas em coletas_mensais (origem 'tabela', substituindo a
 * coleta do agente do mês) e os preços em precos_mensais.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { normalizarUnidades, resumirUnidades, type Resumo, type Unidade } from "@/lib/domain/tabelas";
import { ErroIA, lerTabela } from "@/lib/ia/leitura";

export type StatusLeitura = "lendo" | "para_conferir" | "aprovada" | "recusada";

export interface Leitura {
  id: string;
  idConcorrente: number;
  concorrente: string;
  empreendimento: string;
  regional: string;
  mesAno: string;
  arquivoNome: string;
  arquivoMime: string;
  enviadoPor: string | null;
  enviadoEm: string;
  status: StatusLeitura;
  erroIa: string | null;
  modeloIa: string | null;
  observacoesIa: string | null;
  unidades: Unidade[];
  resumo: Resumo;
  conferidoPor: string | null;
  conferidoEm: string | null;
  motivoRecusa: string | null;
  coletaSubstituida: { estoque: number; vendas: number; agente: string | null } | null;
}

const q = (t: string, p: unknown[] = []) => db().query(t, p);

const SELECT = `
  select l.*, c.concorrente, e.empreendimento, cid.regional, to_char(l.mes_ano, 'YYYY-MM-DD') as mes,
         ue.nome as enviado_nome, uc.nome as conferido_nome
    from leituras_tabela l
    join concorrentes c on c.id_concorrente = l.id_concorrente
    join empreendimentos e on e.id_empreendimento = c.id_empreendimento
    join cidades cid on cid.id_cidade = e.id_cidade
    left join usuarios ue on ue.id_usuario = l.enviado_por
    left join usuarios uc on uc.id_usuario = l.conferido_por`;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function paraLeitura(r: Record<string, unknown>): Leitura {
  return {
    id: String(r.id),
    idConcorrente: Number(r.id_concorrente),
    concorrente: String(r.concorrente),
    empreendimento: String(r.empreendimento),
    regional: String(r.regional),
    mesAno: String(r.mes),
    arquivoNome: String(r.arquivo_nome),
    arquivoMime: String(r.arquivo_mime),
    enviadoPor: (r.enviado_nome as string) ?? null,
    enviadoEm: new Date(r.enviado_em as string).toISOString(),
    status: r.status as StatusLeitura,
    erroIa: (r.erro_ia as string) ?? null,
    modeloIa: (r.modelo_ia as string) ?? null,
    observacoesIa: (r.observacoes_ia as string) ?? null,
    unidades: (r.unidades as Unidade[]) ?? [],
    resumo: {
      totalUnidades: Number(r.total_unidades ?? 0),
      estoque: Number(r.estoque ?? 0),
      disponiveis: Number(r.estoque ?? 0) - Number(r.reservadas ?? 0),
      reservadas: Number(r.reservadas ?? 0),
      vendidasTotal: Number(r.vendidas_total ?? 0),
      vendasMes: num(r.vendas_mes),
      vendasMetodo: (r.vendas_metodo as Resumo["vendasMetodo"]) ?? null,
      valorMin: num(r.valor_min_centavos),
      valorMax: num(r.valor_max_centavos),
      ticketMedio: num(r.ticket_medio_centavos),
      unidadeMin: (r.unidade_min as string) ?? null,
      unidadeMax: (r.unidade_max as string) ?? null,
      descontoMin: num(r.desconto_min_centavos),
      descontoMax: num(r.desconto_max_centavos),
      ticketDesconto: num(r.ticket_desconto_centavos),
    },
    conferidoPor: (r.conferido_nome as string) ?? null,
    conferidoEm: r.conferido_em ? new Date(r.conferido_em as string).toISOString() : null,
    motivoRecusa: (r.motivo_recusa as string) ?? null,
    coletaSubstituida: (r.coleta_substituida as Leitura["coletaSubstituida"]) ?? null,
  };
}

export async function obterLeitura(id: string): Promise<Leitura | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows: [r] } = await q(`${SELECT} where l.id = $1`, [id]);
  return r ? paraLeitura(r) : null;
}

export async function listarLeituras(f: { status?: string } = {}): Promise<Leitura[]> {
  const params: unknown[] = [];
  let sql = SELECT;
  if (f.status) { params.push(f.status); sql += ` where l.status = $1`; }
  sql += " order by l.enviado_em desc limit 200";
  const { rows } = await q(sql, params);
  return rows.map(paraLeitura);
}

export async function contarParaConferir(): Promise<number> {
  const { rows: [r] } = await q(`select count(*)::int as n from leituras_tabela where status = 'para_conferir'`);
  return r.n;
}

export async function lerArquivo(id: string) {
  const { rows: [r] } = await q(`select arquivo, arquivo_mime, arquivo_nome from leituras_tabela where id = $1`, [id]);
  return r ? { bytes: r.arquivo as Buffer, mime: String(r.arquivo_mime), nome: String(r.arquivo_nome) } : null;
}

/** Base para as vendas do mês: última leitura aprovada antes deste mês e o estoque do mês anterior. */
async function referencias(idConcorrente: number, mesAno: string) {
  const { rows: [ant] } = await q(
    `select unidades from leituras_tabela
      where id_concorrente = $1 and status = 'aprovada' and mes_ano < $2 and jsonb_array_length(unidades) > 0
      order by mes_ano desc, conferido_em desc limit 1`,
    [idConcorrente, mesAno],
  );
  const { rows: [col] } = await q(
    `select estoque from coletas_mensais where id_concorrente = $1 and mes_ano = ($2::date - interval '1 month')::date`,
    [idConcorrente, mesAno],
  );
  return { anterior: ant ? { unidades: ant.unidades as Unidade[] } : null, estoqueMesAnterior: col ? Number(col.estoque) : null };
}

async function gravarResumo(id: string, unidades: Unidade[], r: Resumo, extra: Record<string, unknown> = {}) {
  const cols: Record<string, unknown> = {
    unidades: JSON.stringify(unidades),
    total_unidades: r.totalUnidades, estoque: r.estoque, reservadas: r.reservadas, vendidas_total: r.vendidasTotal,
    vendas_mes: r.vendasMes, vendas_metodo: r.vendasMetodo,
    valor_min_centavos: r.valorMin, valor_max_centavos: r.valorMax, ticket_medio_centavos: r.ticketMedio,
    unidade_min: r.unidadeMin, unidade_max: r.unidadeMax,
    desconto_min_centavos: r.descontoMin, desconto_max_centavos: r.descontoMax, ticket_desconto_centavos: r.ticketDesconto, ...extra,
  };
  const nomes = Object.keys(cols);
  await q(
    `update leituras_tabela set ${nomes.map((n, i) => `${n} = $${i + 2}`).join(", ")} where id = $1`,
    [id, ...nomes.map((n) => cols[n])],
  );
}

export async function criarLeitura(d: {
  idConcorrente: number; mesAno: string; nome: string; mime: string; bytes: Buffer; idUsuario: string;
}): Promise<string> {
  const { rows: [r] } = await q(
    `insert into leituras_tabela (id_concorrente, mes_ano, arquivo_nome, arquivo_mime, arquivo, enviado_por)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [d.idConcorrente, d.mesAno, d.nome, d.mime, d.bytes, d.idUsuario],
  );
  return r.id;
}

/** Pede a leitura ao Gemini e deixa a leitura pronta para conferir (com ou sem a lista de unidades). */
export async function processarLeitura(id: string): Promise<void> {
  const { rows: [l] } = await q(`select id_concorrente, mes_ano, arquivo, arquivo_mime from leituras_tabela where id = $1`, [id]);
  if (!l) return;
  try {
    const ia = await lerTabela(l.arquivo as Buffer, String(l.arquivo_mime));
    const unidades = normalizarUnidades(ia.unidades);
    const ref = await referencias(Number(l.id_concorrente), new Date(l.mes_ano).toISOString().slice(0, 10));
    await gravarResumo(id, unidades, resumirUnidades(unidades, ref.anterior, ref.estoqueMesAnterior), {
      status: "para_conferir", erro_ia: unidades.length ? null : "A IA não encontrou unidades no documento.",
      modelo_ia: ia.modelo, observacoes_ia: ia.observacoes || null,
    });
  } catch (e) {
    const msg = e instanceof ErroIA ? e.message : "Erro inesperado na leitura por IA.";
    if (!(e instanceof ErroIA)) console.error("[tabelas] leitura:", e);
    await q(`update leituras_tabela set status = 'para_conferir', erro_ia = $2 where id = $1`, [id, msg]);
  }
}

export interface Conferencia {
  unidades: Unidade[];
  /** Vendas do mês informadas na conferência (substitui o cálculo). */
  vendasMes?: number | null;
  /** Sem lista de unidades: os números são digitados direto. */
  numeros?: {
    estoque: number; reservadas: number; vendasMes: number | null;
    valorMin: number | null; valorMax: number | null; ticketMedio: number | null;
    descontoMin: number | null; descontoMax: number | null; ticketDesconto: number | null;
  } | null;
}

export async function salvarConferencia(id: string, c: Conferencia): Promise<Leitura | null> {
  const l = await obterLeitura(id);
  if (!l || l.status !== "para_conferir") return l;
  const unidades = normalizarUnidades(c.unidades.map((u) => ({
    unidade: u.unidade, status: u.status, status_original: u.statusOriginal,
    valor_tabela: u.valorCentavos != null ? u.valorCentavos / 100 : null,
    valor_desconto: u.valorDescontoCentavos != null ? u.valorDescontoCentavos / 100 : null,
  })));
  let r: Resumo;
  if (c.numeros && !unidades.length) {
    const n = c.numeros;
    r = {
      totalUnidades: 0, estoque: n.estoque, disponiveis: n.estoque - n.reservadas, reservadas: n.reservadas, vendidasTotal: 0,
      vendasMes: n.vendasMes, vendasMetodo: null, valorMin: n.valorMin, valorMax: n.valorMax, ticketMedio: n.ticketMedio,
      unidadeMin: null, unidadeMax: null,
      descontoMin: n.descontoMin, descontoMax: n.descontoMax, ticketDesconto: n.ticketDesconto,
    };
  } else {
    const ref = await referencias(l.idConcorrente, l.mesAno);
    r = resumirUnidades(unidades, ref.anterior, ref.estoqueMesAnterior);
    if (c.vendasMes !== undefined && c.vendasMes !== null && c.vendasMes !== r.vendasMes) {
      r = { ...r, vendasMes: c.vendasMes, vendasMetodo: null };
    }
  }
  await gravarResumo(id, unidades, r);
  return obterLeitura(id);
}

export async function aprovarLeitura(id: string, idUsuario: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const l = await obterLeitura(id);
  if (!l) return { ok: false, erro: "Leitura não encontrada." };
  if (l.status !== "para_conferir") return { ok: false, erro: "Esta leitura não está aguardando conferência." };
  const cliente = await db().connect();
  try {
    await cliente.query("begin");
    const { rows: [atual] } = await cliente.query(
      `select cm.estoque, cm.vendas, cm.origem, ag.nome as agente from coletas_mensais cm
         left join agentes_campo ag on ag.id_agente = cm.id_agente
        where cm.id_concorrente = $1 and cm.mes_ano = $2 for update of cm`,
      [l.idConcorrente, l.mesAno],
    );
    // A coleta do agente do mesmo mês fica guardada na leitura (histórico).
    const substituida = atual && atual.origem === "agente" ? { estoque: atual.estoque, vendas: atual.vendas, agente: atual.agente } : null;
    await cliente.query(
      `insert into coletas_mensais (id_agente, id_concorrente, mes_ano, estoque, vendas, origem, id_leitura)
       values (null, $1, $2, $3, $4, 'tabela', $5)
       on conflict (id_concorrente, mes_ano) do update set
         id_agente = null, estoque = excluded.estoque, vendas = excluded.vendas, origem = 'tabela',
         id_leitura = excluded.id_leitura, atualizado_em = now()`,
      // Sem mês anterior para comparar, as vendas do mês entram como 0.
      [l.idConcorrente, l.mesAno, l.resumo.estoque, l.resumo.vendasMes ?? 0, l.id],
    );
    await cliente.query(
      `insert into precos_mensais (id_concorrente, mes_ano, valor_min_centavos, valor_max_centavos, ticket_medio_centavos, unidade_min, unidade_max, id_leitura,
                                  desconto_min_centavos, desconto_max_centavos, ticket_desconto_centavos)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id_concorrente, mes_ano) do update set
         valor_min_centavos = excluded.valor_min_centavos, valor_max_centavos = excluded.valor_max_centavos,
         ticket_medio_centavos = excluded.ticket_medio_centavos, unidade_min = excluded.unidade_min,
         unidade_max = excluded.unidade_max, id_leitura = excluded.id_leitura,
         desconto_min_centavos = excluded.desconto_min_centavos, desconto_max_centavos = excluded.desconto_max_centavos,
         ticket_desconto_centavos = excluded.ticket_desconto_centavos, atualizado_em = now()`,
      [l.idConcorrente, l.mesAno, l.resumo.valorMin, l.resumo.valorMax, l.resumo.ticketMedio, l.resumo.unidadeMin, l.resumo.unidadeMax, l.id,
        l.resumo.descontoMin, l.resumo.descontoMax, l.resumo.ticketDesconto],
    );
    await cliente.query(
      `update leituras_tabela set status = 'aprovada', conferido_por = $2, conferido_em = now(),
              coleta_substituida = coalesce($3::jsonb, coleta_substituida) where id = $1`,
      [l.id, idUsuario, substituida ? JSON.stringify(substituida) : null],
    );
    await cliente.query("commit");
    return { ok: true };
  } catch (e) {
    await cliente.query("rollback");
    console.error("[tabelas] aprovar:", e);
    return { ok: false, erro: "Não foi possível aprovar a leitura." };
  } finally {
    cliente.release();
  }
}

export async function recusarLeitura(id: string, idUsuario: string, motivo: string) {
  await q(
    `update leituras_tabela set status = 'recusada', conferido_por = $2, conferido_em = now(), motivo_recusa = $3
      where id = $1 and status = 'para_conferir'`,
    [id, idUsuario, motivo.trim().slice(0, 500) || null],
  );
}
