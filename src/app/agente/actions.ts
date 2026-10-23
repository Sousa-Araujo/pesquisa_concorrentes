"use server";

/**
 * Server Actions da Área do Agente (seções 4, 13, 22–24).
 * Toda regra crítica é validada no backend (seção 40). O agente entra com
 * e-mail + código pela entrada única (/entrar) e fica com uma sessão no banco (src/lib/auth/acesso.ts);
 * quem registra a coleta é sempre o agente da sessão.
 */
import { db } from "@/lib/db/pool";
import {
  novoConcorrenteSchema,
  coletaSchema,
} from "@/lib/validation/schemas";
import {
  competenciaVigente,
  competenciaValida,
  formatarCompetenciaCurta,
} from "@/lib/domain/competencia";
import {
  listarRegionais,
  listarCidades,
  listarEmpreendimentos,
  listarConcorrentes,
} from "@/lib/data/hierarquia";
import {
  agenteAtual,
  encerrarSessao,
  exigirAgente,
  usuarioAtual,
} from "@/lib/auth/acesso";

export interface AgenteSessao { id_agente: string; nome: string; }

type Resultado<T> = { ok: true; data: T } | { ok: false; erro: string };

export async function sairAgente(): Promise<void> {
  await encerrarSessao();
}

/** Agente logado ou usuário interno (os seletores também servem o painel). */
async function exigirSessaoCampo(): Promise<void> {
  if (await agenteAtual()) return;
  if (await usuarioAtual()) return;
  throw new Error("Não autorizado");
}

// Seletores em cascata expostos como actions para o cliente.
export async function actRegionais() { await exigirSessaoCampo(); return listarRegionais(); }
export async function actCidades(regional: string) { await exigirSessaoCampo(); return listarCidades(regional); }
export async function actEmpreendimentos(idCidade: number) { await exigirSessaoCampo(); return listarEmpreendimentos(idCidade); }
export async function actConcorrentes(idEmp: number) { await exigirSessaoCampo(); return listarConcorrentes(idEmp); }

/**
 * Cadastro de novo concorrente durante a coleta (seção 13).
 * ID gerado no backend via função SQL transacional com lock (seção 12).
 */
export async function cadastrarConcorrente(input: {
  id_empreendimento: number;
  nome: string;
}): Promise<Resultado<{ id_concorrente: number; concorrente: string }>> {
  await exigirAgente();
  const parsed = novoConcorrenteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { rows } = await db().query<{ id_concorrente: number; concorrente: string }>(
      `select id_concorrente, concorrente from inserir_concorrente($1, $2, $3)`,
      [parsed.data.id_empreendimento, parsed.data.nome, null],
    );
    const row = rows[0];
    return { ok: true, data: { id_concorrente: row.id_concorrente, concorrente: row.concorrente } };
  } catch (e) {
    const erro = e as { code?: string; message?: string };
    if (erro.code === "23505" || /duplicad/i.test(erro.message ?? "")) {
      return { ok: false, erro: "Já existe um concorrente com esse nome neste empreendimento." };
    }
    return { ok: false, erro: "Não foi possível cadastrar o concorrente." };
  }
}

export interface ResumoColeta {
  id_concorrente: number;
  mes_ano: string;
  competencia: string;
  estoque: number;
  vendas: number;
  atualizado: boolean;
}

/**
 * Registro/atualização de coleta (seções 22–24).
 * Competência automática (seção 19). Unicidade concorrente/mês (seção 23):
 * na primeira tentativa não atualiza; se já existir, retorna sinal para o
 * cliente confirmar atualização.
 */
export async function salvarColeta(input: {
  id_concorrente: number;
  estoque: number;
  vendas: number;
  mes_ano?: string;
  atualizar?: boolean;
}): Promise<
  | { ok: true; data: ResumoColeta }
  | { ok: false; erro: string; jaExiste?: boolean; competencia?: string }
> {
  const sessao = await agenteAtual();
  if (!sessao) {
    return { ok: false, erro: "Sua sessão expirou. Entre novamente." };
  }
  const parsed = coletaSchema.safeParse({
    id_concorrente: input.id_concorrente,
    estoque: input.estoque,
    vendas: input.vendas,
    mes_ano: input.mes_ano,
    atualizar: input.atualizar ?? false,
  });
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const pool = db();
  // Competência escolhida pelo agente; se não vier (ou vier inválida), usa a vigente.
  const mes_ano =
    parsed.data.mes_ano && competenciaValida(parsed.data.mes_ano)
      ? parsed.data.mes_ano
      : competenciaVigente();

  // Agente identificado pela sessão (seção 24) — nunca pelo que vem do navegador.
  const idAgente = sessao.id_agente;

  // Coleta existente para o concorrente/mês?
  const { rows: existenteRows } = await pool.query<{ id_coleta: string; origem: string }>(
    `select id_coleta, origem from coletas_mensais where id_concorrente = $1 and mes_ano = $2`,
    [parsed.data.id_concorrente, mes_ano],
  );
  const existente = existenteRows[0];

  // O número vindo da tabela da construtora (conferido) vale mais que a coleta em campo.
  if (existente?.origem === "tabela") {
    return {
      ok: false,
      erro: `Este concorrente já tem os números de ${formatarCompetenciaCurta(mes_ano)} pela tabela da construtora, conferida pela coordenação.`,
    };
  }

  if (existente && !parsed.data.atualizar) {
    return {
      ok: false,
      jaExiste: true,
      competencia: formatarCompetenciaCurta(mes_ano),
      erro: `Já existe uma coleta para este concorrente em ${formatarCompetenciaCurta(mes_ano)}.`,
    };
  }

  if (existente && parsed.data.atualizar) {
    try {
      await pool.query(
        `update coletas_mensais set estoque = $1, vendas = $2, id_agente = $3 where id_coleta = $4`,
        [parsed.data.estoque, parsed.data.vendas, idAgente, existente.id_coleta],
      );
    } catch {
      return { ok: false, erro: "Não foi possível atualizar a coleta." };
    }
    return {
      ok: true,
      data: {
        id_concorrente: parsed.data.id_concorrente,
        mes_ano,
        competencia: formatarCompetenciaCurta(mes_ano),
        estoque: parsed.data.estoque,
        vendas: parsed.data.vendas,
        atualizado: true,
      },
    };
  }

  // Inserção nova.
  try {
    await pool.query(
      `insert into coletas_mensais (id_agente, id_concorrente, mes_ano, estoque, vendas)
       values ($1, $2, $3, $4, $5)`,
      [idAgente, parsed.data.id_concorrente, mes_ano, parsed.data.estoque, parsed.data.vendas],
    );
  } catch (e) {
    const erro = e as { code?: string };
    if (erro.code === "23505") {
      // corrida: alguém inseriu no meio tempo
      return {
        ok: false,
        jaExiste: true,
        competencia: formatarCompetenciaCurta(mes_ano),
        erro: `Já existe uma coleta para este concorrente em ${formatarCompetenciaCurta(mes_ano)}.`,
      };
    }
    return { ok: false, erro: "Não foi possível registrar a coleta." };
  }
  return {
    ok: true,
    data: {
      id_concorrente: parsed.data.id_concorrente,
      mes_ano,
      competencia: formatarCompetenciaCurta(mes_ano),
      estoque: parsed.data.estoque,
      vendas: parsed.data.vendas,
      atualizado: false,
    },
  };
}
