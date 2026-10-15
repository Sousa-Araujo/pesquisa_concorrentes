/**
 * Consultas da Área do Gestor (seções 35, 36).
 * SQL direto via pool pg, executadas no servidor após o guard de gestor
 * (ver src/lib/auth/gestor.ts). Sem RLS: a autorização é 100% na camada de
 * aplicação, já que a conexão com o banco é única e nunca chega ao navegador.
 */
import { db } from "@/lib/db/pool";

export interface LinhaPesquisa {
  id_coleta: string;
  id_concorrente: number;
  coletado_em: string;
  atualizado_em: string;
  agente: string;
  regional: string;
  cidade: string;
  empreendimento: string;
  concorrente: string;
  mes_ano: string;
  estoque: number;
  vendas: number;
}

export interface FiltroPesquisas {
  mesAno?: string;
  regional?: string;
  idCidade?: number;
  idEmpreendimento?: number;
  idConcorrente?: number;
  idAgente?: string;
  limite?: number;
  offset?: number;
  /** Coluna de ordenação (seção 35: "permitir ordenação e paginação"). */
  ordenarPor?: "data" | "concorrente" | "estoque" | "vendas";
  direcao?: "asc" | "desc";
}

/** Whitelist de colunas ordenáveis — nunca interpolar a coluna vinda do usuário direto no SQL. */
const COLUNAS_ORDENACAO: Record<NonNullable<FiltroPesquisas["ordenarPor"]>, string> = {
  data: "cm.coletado_em",
  concorrente: "c.concorrente",
  estoque: "cm.estoque",
  vendas: "cm.vendas",
};

export async function listarPesquisas(f: FiltroPesquisas): Promise<LinhaPesquisa[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.mesAno) where.push(`cm.mes_ano = ${bind(f.mesAno)}`);
  if (f.idConcorrente) where.push(`cm.id_concorrente = ${bind(f.idConcorrente)}`);
  if (f.idAgente) where.push(`cm.id_agente = ${bind(f.idAgente)}`);
  if (f.idEmpreendimento) where.push(`c.id_empreendimento = ${bind(f.idEmpreendimento)}`);
  if (f.regional) where.push(`cid.regional = ${bind(f.regional)}`);
  if (f.idCidade) where.push(`emp.id_cidade = ${bind(f.idCidade)}`);

  const colunaOrdenacao = COLUNAS_ORDENACAO[f.ordenarPor ?? "data"] ?? COLUNAS_ORDENACAO.data;
  const direcao = f.direcao === "asc" ? "asc" : "desc";

  const limite = bind(f.limite ?? 50);
  const offset = bind(f.offset ?? 0);

  const { rows } = await db().query<LinhaPesquisa>(
    `select cm.id_coleta, cm.id_concorrente, cm.coletado_em, cm.atualizado_em,
            cm.mes_ano, cm.estoque, cm.vendas,
            ag.nome as agente, cid.regional, cid.cidade,
            emp.empreendimento, c.concorrente
       from coletas_mensais cm
       join agentes_campo ag  on ag.id_agente = cm.id_agente
       join concorrentes c    on c.id_concorrente = cm.id_concorrente
       join empreendimentos emp on emp.id_empreendimento = c.id_empreendimento
       join cidades cid       on cid.id_cidade = emp.id_cidade
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by ${colunaOrdenacao} ${direcao}, cm.id_coleta
       limit ${limite} offset ${offset}`,
    params,
  );
  return rows;
}

export interface LinhaAgente {
  id_agente: string;
  nome: string;
  telefone: string;
  email: string | null;
  ativo: boolean;
  created_at: string;
  ultima_coleta: string | null;
}

export async function listarAgentes(): Promise<LinhaAgente[]> {
  const { rows } = await db().query<LinhaAgente>(
    `select a.id_agente, a.nome, a.telefone, a.email, a.ativo, a.created_at,
            max(cm.coletado_em) as ultima_coleta
       from agentes_campo a
       left join coletas_mensais cm on cm.id_agente = a.id_agente
      group by a.id_agente
      order by a.nome`,
  );
  return rows;
}

export interface DadoProprio {
  id_empreendimento: number;
  mes_ano: string;
  estoque: number;
  vendas: number;
  atualizado_em: string | null;
}

/** Lê os dados próprios de um empreendimento numa competência (seção 25). */
export async function obterDadosProprios(
  idEmpreendimento: number,
  mesAno: string,
): Promise<DadoProprio | null> {
  const { rows } = await db().query<DadoProprio>(
    `select id_empreendimento, mes_ano, estoque, vendas, atualizado_em
       from dados_proprios_mensais
      where id_empreendimento = $1 and mes_ano = $2`,
    [idEmpreendimento, mesAno],
  );
  return rows[0] ?? null;
}

/** Opções de agente para filtros (id + nome), ordenadas por nome. */
export async function listarAgentesOpcoes(): Promise<{ id_agente: string; nome: string }[]> {
  const { rows } = await db().query<{ id_agente: string; nome: string }>(
    `select id_agente, nome from agentes_campo order by nome`,
  );
  return rows;
}

export interface LinhaUsuario {
  id_usuario: string;
  nome: string;
  email: string;
  perfis: string[];
  ativo: boolean;
  /** Último dia de acesso (YYYY-MM-DD, horário de Brasília), ou null. */
  acesso_ate: string | null;
  acesso_expirado: boolean;
  ultimo_acesso_em: string | null;
  convite_enviado_em: string | null;
  criado_por: string | null;
}

/** Usuários para a tela de administração. `soAvaliadores` = visão do Coordenador de Market Share. */
export async function listarUsuarios(soAvaliadores = false): Promise<LinhaUsuario[]> {
  const { rows } = await db().query<LinhaUsuario>(
    `select u.id_usuario, u.nome, u.email, u.perfis, u.ativo,
            to_char((u.acesso_expira_em at time zone 'America/Sao_Paulo') - interval '1 day', 'YYYY-MM-DD') as acesso_ate,
            coalesce(u.acesso_expira_em <= now(), false) as acesso_expirado,
            u.ultimo_acesso_em, u.convite_enviado_em, cb.nome as criado_por
       from usuarios u
       left join usuarios cb on cb.id_usuario = u.created_by
      where not $1 or u.perfis = '{avaliador}'
      order by u.ativo desc, u.nome`,
    [soAvaliadores],
  );
  return rows;
}

export interface LinhaEmpreendimento {
  id_empreendimento: number;
  id_cidade: number;
  empreendimento: string;
  ativo: boolean;
  cidade: string;
  regional: string;
}

export interface FiltroCadastro {
  regional?: string;
  idCidade?: number;
}

/**
 * Lista empreendimentos para a área administrativa (seção 26) — inclui
 * inativos (diferente de `listarEmpreendimentos` em data/hierarquia.ts,
 * que só traz ativos e serve os seletores em cascata do fluxo do Agente).
 */
export async function listarEmpreendimentosAdmin(f: FiltroCadastro = {}): Promise<LinhaEmpreendimento[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };

  if (f.regional) where.push(`cid.regional = ${bind(f.regional)}`);
  if (f.idCidade) where.push(`emp.id_cidade = ${bind(f.idCidade)}`);

  const { rows } = await db().query<LinhaEmpreendimento>(
    `select emp.id_empreendimento, emp.id_cidade, emp.empreendimento, emp.ativo,
            cid.cidade, cid.regional
       from empreendimentos emp
       join cidades cid on cid.id_cidade = emp.id_cidade
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by cid.regional, cid.cidade, emp.empreendimento`,
    params,
  );
  return rows;
}

export interface LinhaConcorrente {
  id_concorrente: number;
  id_empreendimento: number;
  concorrente: string;
  ativo: boolean;
  empreendimento: string;
  cidade: string;
  regional: string;
}

/**
 * Lista concorrentes para a área administrativa (seção 26) — inclui
 * inativos, com a hierarquia completa para exibição/filtro (diferente de
 * `listarConcorrentes` em data/hierarquia.ts, que só serve os seletores em
 * cascata do fluxo do Agente e só traz ativos de um empreendimento).
 */
export async function listarConcorrentesAdmin(
  f: FiltroCadastro & { idEmpreendimento?: number } = {},
): Promise<LinhaConcorrente[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };

  if (f.regional) where.push(`cid.regional = ${bind(f.regional)}`);
  if (f.idCidade) where.push(`emp.id_cidade = ${bind(f.idCidade)}`);
  if (f.idEmpreendimento) where.push(`c.id_empreendimento = ${bind(f.idEmpreendimento)}`);

  const { rows } = await db().query<LinhaConcorrente>(
    `select c.id_concorrente, c.id_empreendimento, c.concorrente, c.ativo,
            emp.empreendimento, cid.cidade, cid.regional
       from concorrentes c
       join empreendimentos emp on emp.id_empreendimento = c.id_empreendimento
       join cidades cid         on cid.id_cidade = emp.id_cidade
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by cid.regional, cid.cidade, emp.empreendimento, c.concorrente`,
    params,
  );
  return rows;
}
