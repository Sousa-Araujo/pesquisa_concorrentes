"use server";

/**
 * Server Actions do painel da Pesquisa de Concorrentes (seções 3, 36, 25).
 * Cada ação confere a sessão e a permissão do perfil de quem chama
 * (src/lib/auth/perfis.ts) antes de tocar no banco.
 */
import type { PoolClient } from "pg";
import { db } from "@/lib/db/pool";
import { encerrarSessoesDoAgente, exigirPermissao } from "@/lib/auth/acesso";
import {
  agenteSchema,
  coletaEdicaoSchema,
  dadosPropriosSchema,
  novoConcorrenteSchema,
  concorrenteEdicaoSchema,
  empreendimentoSchema,
  empreendimentoEdicaoSchema,
} from "@/lib/validation/schemas";

type R<T = void> = { ok: true; data?: T } | { ok: false; erro: string };

export async function criarAgente(input: {
  nome: string; telefone: string; email?: string; ativo: boolean;
}): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const parsed = agenteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  const pool = db();
  // Verifica duplicidade de telefone normalizado (seção 36).
  const { rows: existe } = await pool.query<{ id_agente: string }>(
    `select id_agente from agentes_campo where telefone = $1`,
    [parsed.data.telefone],
  );
  if (existe[0]) return { ok: false, erro: "Já existe um agente com este telefone." };

  try {
    await pool.query(
      `insert into agentes_campo (nome, telefone, email, ativo, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $5)`,
      [parsed.data.nome, parsed.data.telefone, parsed.data.email, parsed.data.ativo, g.id_usuario],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, erro: "E-mail já usado por outro agente." };
    return { ok: false, erro: "Não foi possível cadastrar o agente." };
  }
  return { ok: true };
}

export async function editarAgente(id: string, input: {
  nome: string; telefone: string; email?: string; ativo: boolean;
}): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const parsed = agenteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  const pool = db();
  const { rows: outro } = await pool.query<{ id_agente: string }>(
    `select id_agente from agentes_campo where telefone = $1 and id_agente <> $2`,
    [parsed.data.telefone, id],
  );
  if (outro[0]) return { ok: false, erro: "Telefone já usado por outro agente." };

  try {
    await pool.query(
      `update agentes_campo set nome = $1, telefone = $2, email = $3, ativo = $4, updated_by = $5 where id_agente = $6`,
      [parsed.data.nome, parsed.data.telefone, parsed.data.email, parsed.data.ativo, g.id_usuario, id],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, erro: "E-mail já usado por outro agente." };
    return { ok: false, erro: "Não foi possível salvar as alterações." };
  }
  if (!parsed.data.ativo) await encerrarSessoesDoAgente(id);
  return { ok: true };
}

/** Ativa/inativa (nunca exclui fisicamente — seção 6). */
export async function definirStatusAgente(id: string, ativo: boolean): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  try {
    await db().query(
      `update agentes_campo set ativo = $1, updated_by = $2 where id_agente = $3`,
      [ativo, g.id_usuario, id],
    );
  } catch {
    return { ok: false, erro: "Não foi possível alterar o status." };
  }
  if (!ativo) await encerrarSessoesDoAgente(id);
  return { ok: true };
}

/**
 * Cadastro de concorrente pelo Gestor (seção 2: "cadastrar concorrentes").
 * Mesma função de backend do fluxo do Agente (seção 13) — geração de ID
 * com lock e checagem de duplicidade centralizadas em SQL — só muda quem
 * assina como created_by.
 */
export async function criarConcorrenteGestor(input: {
  id_empreendimento: number; nome: string;
}): Promise<R<{ id_concorrente: number }>> {
  const g = await exigirPermissao("cadastros");
  const parsed = novoConcorrenteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { rows } = await db().query<{ id_concorrente: number }>(
      `select id_concorrente from inserir_concorrente($1, $2, $3)`,
      [parsed.data.id_empreendimento, parsed.data.nome, g.id_usuario],
    );
    return { ok: true, data: { id_concorrente: rows[0].id_concorrente } };
  } catch (e) {
    const erro = e as { code?: string; message?: string };
    if (erro.code === "23505" || /duplicad/i.test(erro.message ?? "")) {
      return { ok: false, erro: "Já existe um concorrente com esse nome neste empreendimento." };
    }
    return { ok: false, erro: "Não foi possível cadastrar o concorrente." };
  }
}

/**
 * Edição de concorrente pelo Gestor (seção 2: "editar cadastros
 * permitidos"). O empreendimento pai não é editável — ver schemas.ts.
 */
export async function editarConcorrente(
  id: number,
  input: { concorrente: string; ativo: boolean },
): Promise<R> {
  const g = await exigirPermissao("cadastros");
  const parsed = concorrenteEdicaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  try {
    await db().query(
      `update concorrentes set concorrente = $1, ativo = $2, updated_by = $3 where id_concorrente = $4`,
      [parsed.data.concorrente, parsed.data.ativo, g.id_usuario, id],
    );
  } catch (e) {
    const erro = e as { code?: string };
    if (erro.code === "23505") {
      return { ok: false, erro: "Já existe um concorrente com esse nome neste empreendimento." };
    }
    return { ok: false, erro: "Não foi possível salvar as alterações." };
  }
  return { ok: true };
}

/** Ativa/inativa concorrente (nunca exclui fisicamente — mesma regra dos agentes). */
export async function definirStatusConcorrente(id: number, ativo: boolean): Promise<R> {
  const g = await exigirPermissao("cadastros");
  try {
    await db().query(
      `update concorrentes set ativo = $1, updated_by = $2 where id_concorrente = $3`,
      [ativo, g.id_usuario, id],
    );
  } catch {
    return { ok: false, erro: "Não foi possível alterar o status." };
  }
  return { ok: true };
}

/**
 * Cadastro de empreendimento pelo Gestor (seção 10). Diferente do
 * concorrente, o ID é informado pelo gestor, não gerado — ver schemas.ts.
 */
export async function criarEmpreendimento(input: {
  id_empreendimento: number; id_cidade: number; empreendimento: string; ativo: boolean;
}): Promise<R> {
  await exigirPermissao("cadastros");
  const parsed = empreendimentoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  const pool = db();
  const { rows: existe } = await pool.query<{ id_empreendimento: number }>(
    `select id_empreendimento from empreendimentos where id_empreendimento = $1`,
    [parsed.data.id_empreendimento],
  );
  if (existe[0]) return { ok: false, erro: "Já existe um empreendimento com este ID." };

  try {
    await pool.query(
      `insert into empreendimentos (id_empreendimento, id_cidade, empreendimento, ativo)
       values ($1, $2, $3, $4)`,
      [parsed.data.id_empreendimento, parsed.data.id_cidade, parsed.data.empreendimento, parsed.data.ativo],
    );
  } catch (e) {
    const erro = e as { code?: string };
    if (erro.code === "23503") return { ok: false, erro: "Cidade inválida." };
    return { ok: false, erro: "Não foi possível cadastrar o empreendimento." };
  }
  return { ok: true };
}

export async function editarEmpreendimento(
  id: number,
  input: { id_cidade: number; empreendimento: string; ativo: boolean },
): Promise<R> {
  await exigirPermissao("cadastros");
  const parsed = empreendimentoEdicaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  try {
    await db().query(
      `update empreendimentos set id_cidade = $1, empreendimento = $2, ativo = $3 where id_empreendimento = $4`,
      [parsed.data.id_cidade, parsed.data.empreendimento, parsed.data.ativo, id],
    );
  } catch (e) {
    const erro = e as { code?: string };
    if (erro.code === "23503") return { ok: false, erro: "Cidade inválida." };
    return { ok: false, erro: "Não foi possível salvar as alterações." };
  }
  return { ok: true };
}

/** Ativa/inativa empreendimento (nunca exclui fisicamente — mesma regra dos agentes). */
export async function definirStatusEmpreendimento(id: number, ativo: boolean): Promise<R> {
  await exigirPermissao("cadastros");
  try {
    await db().query(`update empreendimentos set ativo = $1 where id_empreendimento = $2`, [ativo, id]);
  } catch {
    return { ok: false, erro: "Não foi possível alterar o status." };
  }
  return { ok: true };
}

/** Cadastro/atualização dos dados próprios do empreendimento (seção 25). */
export async function salvarDadosProprios(input: {
  id_empreendimento: number; mes_ano: string; estoque: number; vendas: number;
}): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const parsed = dadosPropriosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  try {
    await db().query(
      `insert into dados_proprios_mensais
         (id_empreendimento, mes_ano, estoque, vendas, atualizado_por, atualizado_em)
       values ($1, $2, $3, $4, $5, now())
       on conflict (id_empreendimento, mes_ano) do update
         set estoque = excluded.estoque,
             vendas = excluded.vendas,
             atualizado_por = excluded.atualizado_por,
             atualizado_em = now()`,
      [parsed.data.id_empreendimento, parsed.data.mes_ano, parsed.data.estoque, parsed.data.vendas, g.id_usuario],
    );
  } catch {
    return { ok: false, erro: "Não foi possível salvar os dados próprios." };
  }
  return { ok: true };
}

/**
 * Correção de uma coleta já registrada (extensão fora da especificação).
 * Ajusta estoque, vendas e competência; registra o gestor em atualizado_por.
 * A unicidade (id_concorrente, mes_ano) continua valendo: mudar a competência
 * para um mês que já tem coleta do mesmo concorrente é bloqueado.
 */
export async function editarColeta(idColeta: string, input: {
  estoque: number; vendas: number; mes_ano: string;
}): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const parsed = coletaEdicaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  try {
    const { rowCount } = await db().query(
      `update coletas_mensais
          set estoque = $1, vendas = $2, mes_ano = $3, atualizado_por = $4
        where id_coleta = $5`,
      [parsed.data.estoque, parsed.data.vendas, parsed.data.mes_ano, g.id_usuario, idColeta],
    );
    if (!rowCount) return { ok: false, erro: "Coleta não encontrada." };
  } catch (e) {
    const erro = e as { code?: string };
    if (erro.code === "23505") {
      return { ok: false, erro: "Já existe uma coleta deste concorrente na competência escolhida." };
    }
    return { ok: false, erro: "Não foi possível salvar as alterações." };
  }
  return { ok: true };
}

/**
 * Copia a linha para `exclusoes_auditoria` (quem apagou, quando, snapshot)
 * antes de o chamador apagá-la de fato. Sempre dentro da mesma transação.
 */
async function registrarExclusao(
  client: PoolClient,
  entidade: "coleta_mensal" | "dados_proprios_mensal",
  idRegistro: string,
  dados: unknown,
  idGestor: string,
): Promise<void> {
  await client.query(
    `insert into exclusoes_auditoria (entidade, id_registro, dados, excluido_por)
     values ($1, $2, $3, $4)`,
    [entidade, idRegistro, JSON.stringify(dados), idGestor],
  );
}

/** Exclui uma coleta de concorrente, guardando o snapshot em auditoria. */
export async function excluirColeta(idColeta: string): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const client = await db().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `select * from coletas_mensais where id_coleta = $1 for update`,
      [idColeta],
    );
    const registro = rows[0];
    if (!registro) {
      await client.query("rollback");
      return { ok: false, erro: "Coleta não encontrada." };
    }
    await registrarExclusao(client, "coleta_mensal", idColeta, registro, g.id_usuario);
    await client.query(`delete from coletas_mensais where id_coleta = $1`, [idColeta]);
    await client.query("commit");
  } catch {
    await client.query("rollback").catch(() => {});
    return { ok: false, erro: "Não foi possível excluir a coleta." };
  } finally {
    client.release();
  }
  return { ok: true };
}

/** Exclui o registro de dados próprios de um empreendimento numa competência. */
export async function excluirDadosProprios(idEmpreendimento: number, mesAno: string): Promise<R> {
  const g = await exigirPermissao("auditoriaPesquisa");
  const client = await db().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `select * from dados_proprios_mensais
        where id_empreendimento = $1 and mes_ano = $2 for update`,
      [idEmpreendimento, mesAno],
    );
    const registro = rows[0];
    if (!registro) {
      await client.query("rollback");
      return { ok: false, erro: "Não há dados próprios nesta competência." };
    }
    await registrarExclusao(client, "dados_proprios_mensal", registro.id_registro, registro, g.id_usuario);
    await client.query(`delete from dados_proprios_mensais where id_registro = $1`, [registro.id_registro]);
    await client.query("commit");
  } catch {
    await client.query("rollback").catch(() => {});
    return { ok: false, erro: "Não foi possível excluir o registro." };
  } finally {
    client.release();
  }
  return { ok: true };
}
