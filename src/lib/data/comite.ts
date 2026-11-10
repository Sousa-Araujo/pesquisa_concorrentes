/**
 * Comitê de vendas (só administrador): guardar o PDF, pedir a leitura à IA,
 * conferir as linhas e, na aprovação, gravar as condições de cada
 * empreendimento Sousa em comite_condicoes — que o Quadro Comparativo lê.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import {
  chaveEmpreendimento, empreendimentosRepetidos, entregaComoData, ligarLinhas, normalizarLinhasIA, problemasDaLinha,
  type CondicaoComite, type EmpreendimentoCadastro, type LinhaComite,
} from "@/lib/domain/comite";
import { ErroIA } from "@/lib/ia/comum";
import { lerComite } from "@/lib/ia/comite";

export type StatusComite = "lendo" | "para_conferir" | "aprovado" | "recusado";

export interface Comite {
  id: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  arquivoNome: string;
  enviadoPor: string | null;
  enviadoEm: string;
  status: StatusComite;
  erroIa: string | null;
  modeloIa: string | null;
  observacoesIa: string | null;
  linhas: LinhaComite[];
  conferidoPor: string | null;
  conferidoEm: string | null;
  motivoRecusa: string | null;
}

const q = (t: string, p: unknown[] = []) => db().query(t, p);

// Sem a coluna "arquivo" (PDF): ela só é lida em lerArquivoComite/processarComite.
const SELECT = `
  select c.id, to_char(c.vigencia_inicio, 'YYYY-MM-DD') as vigencia_inicio, to_char(c.vigencia_fim, 'YYYY-MM-DD') as vigencia_fim,
         c.arquivo_nome, c.enviado_em, c.status, c.erro_ia, c.modelo_ia, c.observacoes_ia, c.linhas,
         c.conferido_em, c.motivo_recusa, ue.nome as enviado_nome, uc.nome as conferido_nome
    from comites_vendas c
    left join usuarios ue on ue.id_usuario = c.enviado_por
    left join usuarios uc on uc.id_usuario = c.conferido_por`;

function paraComite(r: Record<string, unknown>): Comite {
  return {
    id: String(r.id),
    vigenciaInicio: String(r.vigencia_inicio),
    vigenciaFim: String(r.vigencia_fim),
    arquivoNome: String(r.arquivo_nome),
    enviadoPor: (r.enviado_nome as string) ?? null,
    enviadoEm: new Date(r.enviado_em as string).toISOString(),
    status: r.status as StatusComite,
    erroIa: (r.erro_ia as string) ?? null,
    modeloIa: (r.modelo_ia as string) ?? null,
    observacoesIa: (r.observacoes_ia as string) ?? null,
    linhas: (r.linhas as LinhaComite[]) ?? [],
    conferidoPor: (r.conferido_nome as string) ?? null,
    conferidoEm: r.conferido_em ? new Date(r.conferido_em as string).toISOString() : null,
    motivoRecusa: (r.motivo_recusa as string) ?? null,
  };
}

const ehId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function obterComite(id: string): Promise<Comite | null> {
  if (!ehId(id)) return null;
  const { rows: [r] } = await q(`${SELECT} where c.id = $1`, [id]);
  return r ? paraComite(r) : null;
}

export async function listarComites(): Promise<Comite[]> {
  const { rows } = await q(`${SELECT} order by c.vigencia_inicio desc, c.enviado_em desc limit 100`);
  return rows.map(paraComite);
}

export async function lerArquivoComite(id: string) {
  if (!ehId(id)) return null;
  const { rows: [r] } = await q(`select arquivo, arquivo_mime, arquivo_nome from comites_vendas where id = $1`, [id]);
  return r ? { bytes: r.arquivo as Buffer, mime: String(r.arquivo_mime), nome: String(r.arquivo_nome) } : null;
}

export async function criarComite(d: {
  vigenciaInicio: string; vigenciaFim: string; nome: string; mime: string; bytes: Buffer; idUsuario: string;
}): Promise<string> {
  const { rows: [r] } = await q(
    `insert into comites_vendas (vigencia_inicio, vigencia_fim, arquivo_nome, arquivo_mime, arquivo, enviado_por)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [d.vigenciaInicio, d.vigenciaFim, d.nome, d.mime, d.bytes, d.idUsuario],
  );
  return r.id;
}

/** Empreendimentos ativos do cadastro, para ligar os produtos do PDF. */
export async function cadastroParaComite(): Promise<(EmpreendimentoCadastro & { cidade: string; regional: string })[]> {
  const { rows } = await q(
    `select e.id_empreendimento as id, e.empreendimento as nome, c.cidade, c.regional
       from empreendimentos e join cidades c on c.id_cidade = e.id_cidade
      where e.ativo order by e.empreendimento`,
  );
  return rows.map((r) => ({ id: Number(r.id), nome: String(r.nome), cidade: String(r.cidade), regional: String(r.regional) }));
}

async function apelidos(): Promise<Map<string, number>> {
  const { rows } = await q(`select chave_pdf, id_empreendimento from comite_apelidos`);
  return new Map(rows.map((r) => [String(r.chave_pdf), Number(r.id_empreendimento)]));
}

/** Pede a leitura à IA e deixa o comitê pronto para conferir (com ou sem linhas). */
export async function processarComite(id: string): Promise<void> {
  const { rows: [c] } = await q(`select arquivo, arquivo_mime from comites_vendas where id = $1 and status in ('lendo', 'para_conferir')`, [id]);
  if (!c) return;
  try {
    const ia = await lerComite(c.arquivo as Buffer, String(c.arquivo_mime));
    const linhas = ligarLinhas(normalizarLinhasIA(ia.linhas), await cadastroParaComite(), await apelidos());
    await q(
      `update comites_vendas set status = 'para_conferir', linhas = $2::jsonb, erro_ia = $3, modelo_ia = $4, observacoes_ia = $5 where id = $1`,
      [id, JSON.stringify(linhas), linhas.length ? null : "A IA não encontrou produtos no documento.", ia.modelo, ia.observacoes || null],
    );
  } catch (e) {
    const msg = e instanceof ErroIA ? e.message : "Erro inesperado na leitura por IA.";
    if (!(e instanceof ErroIA)) console.error("[comite] leitura:", e);
    await q(`update comites_vendas set status = 'para_conferir', erro_ia = $2 where id = $1`, [id, msg]);
  }
}

export async function salvarConferenciaComite(id: string, linhas: LinhaComite[]): Promise<void> {
  await q(`update comites_vendas set linhas = $2::jsonb where id = $1 and status = 'para_conferir'`, [id, JSON.stringify(linhas)]);
}

export async function aprovarComite(id: string, idUsuario: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const cliente = await db().connect();
  try {
    await cliente.query("begin");
    const { rows: [c] } = await cliente.query(
      `select to_char(vigencia_inicio, 'YYYY-MM-DD') as ini, to_char(vigencia_fim, 'YYYY-MM-DD') as fim, status, linhas
         from comites_vendas where id = $1 for update`, [id],
    );
    if (!c) { await cliente.query("rollback"); return { ok: false, erro: "Comitê não encontrado." }; }
    if (c.status !== "para_conferir") { await cliente.query("rollback"); return { ok: false, erro: "Este comitê não está aguardando conferência." }; }
    const linhas = (c.linhas as LinhaComite[]).filter((l) => !l.ignorar);
    if (!linhas.length) { await cliente.query("rollback"); return { ok: false, erro: "Não há nenhuma linha para aprovar." }; }
    const comProblema = linhas.filter((l) => problemasDaLinha(l).length);
    if (comProblema.length) {
      await cliente.query("rollback");
      return { ok: false, erro: `${comProblema.length} linha(s) ainda com pendência (ex.: ${comProblema[0].produto}). Corrija ou marque para ignorar.` };
    }
    if (empreendimentosRepetidos(linhas).length) {
      await cliente.query("rollback");
      return { ok: false, erro: "Há empreendimentos escolhidos em mais de uma linha. Cada empreendimento só pode ter uma condição por comitê." };
    }
    // Um novo comitê com a mesma vigência substitui o anterior (como no GDP).
    await cliente.query(
      `delete from comites_vendas where id <> $1 and status = 'aprovado' and vigencia_inicio = $2 and vigencia_fim = $3`, [id, c.ini, c.fim],
    );
    await cliente.query(`delete from comite_condicoes where id_comite = $1`, [id]);
    for (const l of linhas) {
      await cliente.query(
        `insert into comite_condicoes (id_comite, id_empreendimento, produto, regional, previsao_entrega, entrega, parcelas_pre, parcelas_pos,
                                       pos_percentual, desconto_financiado_pct, desconto_financiado_obs, desconto_avista_pct, desconto_avista_obs)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, l.idEmpreendimento, l.produto, l.regional || null, l.previsaoEntrega || null, entregaComoData(l.previsaoEntrega),
          l.parcelasPre, l.parcelasPos, l.posPercentual, l.descontoFinanciado, l.descontoFinanciadoObs || null,
          l.descontoAvista, l.descontoAvistaObs || null],
      );
      const chave = chaveEmpreendimento(l.produto);
      if (chave) await cliente.query(
        `insert into comite_apelidos (chave_pdf, nome_pdf, id_empreendimento) values ($1, $2, $3)
         on conflict (chave_pdf) do update set nome_pdf = excluded.nome_pdf, id_empreendimento = excluded.id_empreendimento`,
        [chave, l.produto, l.idEmpreendimento],
      );
    }
    await cliente.query(`update comites_vendas set status = 'aprovado', conferido_por = $2, conferido_em = now() where id = $1`, [id, idUsuario]);
    await cliente.query("commit");
    return { ok: true };
  } catch (e) {
    await cliente.query("rollback");
    console.error("[comite] aprovar:", e);
    return { ok: false, erro: "Não foi possível aprovar o comitê." };
  } finally {
    cliente.release();
  }
}

export async function recusarComite(id: string, idUsuario: string, motivo: string) {
  await q(
    `update comites_vendas set status = 'recusado', conferido_por = $2, conferido_em = now(), motivo_recusa = $3
      where id = $1 and status = 'para_conferir'`,
    [id, idUsuario, motivo.trim().slice(0, 500) || null],
  );
}

/** Exclui o comitê e, se já aprovado, as condições que ele deu ao Quadro Comparativo. */
export async function excluirComite(id: string): Promise<void> {
  if (ehId(id)) await q(`delete from comites_vendas where id = $1`, [id]);
}

/**
 * Condição do comitê aprovado que vale para o empreendimento na competência
 * ("AAAA-MM-01"): entre os comitês cuja vigência toca o mês, o que começou
 * por último. null quando nenhum comitê cobre o mês.
 */
export async function condicaoDoComite(idEmpreendimento: number, mesAno: string): Promise<CondicaoComite | null> {
  const { rows: [r] } = await q(
    `select to_char(c.vigencia_inicio, 'YYYY-MM-DD') as ini, to_char(c.vigencia_fim, 'YYYY-MM-DD') as fim,
            k.desconto_financiado_pct, k.parcelas_pre, k.parcelas_pos, to_char(k.entrega, 'YYYY-MM-DD') as entrega
       from comite_condicoes k join comites_vendas c on c.id = k.id_comite
      where k.id_empreendimento = $1 and c.status = 'aprovado'
        and c.vigencia_inicio < ($2::date + interval '1 month') and c.vigencia_fim >= $2::date
      order by c.vigencia_inicio desc, c.vigencia_fim desc limit 1`,
    [idEmpreendimento, mesAno],
  );
  if (!r) return null;
  return {
    descontoPct: r.desconto_financiado_pct === null ? null : Number(r.desconto_financiado_pct) / 100,
    parcelasPre: r.parcelas_pre === null ? null : Number(r.parcelas_pre),
    parcelasPos: r.parcelas_pos === null ? null : Number(r.parcelas_pos),
    entrega: (r.entrega as string) ?? null,
    vigenciaInicio: String(r.ini),
    vigenciaFim: String(r.fim),
  };
}
