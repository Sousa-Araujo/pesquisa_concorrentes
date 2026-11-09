"use server";

/**
 * Gestão de usuários (todos os perfis, exceto agente de campo).
 * - Administrador: cria e altera qualquer usuário.
 * - Coordenador de Market Share: só usuários cujo único perfil é
 *   `avaliador` (inclusive acesso temporário).
 * Sem senha: ao criar, o sistema envia um convite por e-mail. Sem exclusão
 * física — apenas inativação, que derruba as sessões abertas na hora.
 */
import { db } from "@/lib/db/pool";
import {
  encerrarSessoesDoUsuario,
  enviarConvite,
  exigirPermissao,
  type UsuarioAtual,
} from "@/lib/auth/acesso";
import { podeGerirUsuarioCom } from "@/lib/auth/perfis";
import { emailSimulado, enviarEmail } from "@/lib/notificacoes/envio";
import { emailTeste } from "@/lib/notificacoes/modelos";
import { usuarioSchema } from "@/lib/validation/schemas";

type R = { ok: true; aviso?: string } | { ok: false; erro: string };

export interface UsuarioForm {
  nome: string;
  email: string;
  perfis: string[];
  acesso_expira_em: string;
  ativo: boolean;
}

/** Fim do último dia de acesso, no horário de Brasília. */
const EXPIRA_SQL = `(($X::date + 1)::timestamp at time zone 'America/Sao_Paulo')`;
const expira = (n: number) => EXPIRA_SQL.replace("$X", `$${n}`);

async function carregarAlvo(id: string) {
  const { rows } = await db().query<{ perfis: string[]; ativo: boolean }>(
    `select perfis, ativo from usuarios where id_usuario = $1`,
    [id],
  );
  return rows[0];
}

/** Nunca deixa o sistema sem um administrador ativo. */
async function outroAdminAtivo(idAlvo: string): Promise<boolean> {
  const { rows } = await db().query<{ n: number }>(
    `select count(*)::int as n from usuarios
      where ativo and 'admin' = any(perfis) and acesso_expira_em is null and id_usuario <> $1`,
    [idAlvo],
  );
  return rows[0].n > 0;
}

function semPermissao(): R {
  return { ok: false, erro: "Você não tem permissão para gerir usuários com esse perfil." };
}

function erroBanco(e: unknown, padrao: string): R {
  if ((e as { code?: string }).code === "23505") return { ok: false, erro: "Já existe um usuário com este e-mail." };
  return { ok: false, erro: padrao };
}

export async function criarUsuario(input: UsuarioForm): Promise<R> {
  const eu = await exigirPermissao("gerirUsuarios");
  const parsed = usuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!podeGerirUsuarioCom(eu.perfis, d.perfis)) return semPermissao();

  let id: string;
  try {
    const { rows } = await db().query<{ id_usuario: string }>(
      `insert into usuarios (nome, email, perfis, ativo, acesso_expira_em, created_by, updated_by)
       values ($1, $2, $3, $4, ${expira(5)}, $6, $6) returning id_usuario`,
      [d.nome, d.email, d.perfis, d.ativo, d.acesso_expira_em, eu.id_usuario],
    );
    id = rows[0].id_usuario;
  } catch (e) {
    return erroBanco(e, "Não foi possível cadastrar o usuário.");
  }
  if (!d.ativo) return { ok: true };
  const convite = await enviarConvite(id);
  return convite.ok ? { ok: true, aviso: `Convite enviado para ${d.email}.` } : convite;
}

export async function editarUsuario(id: string, input: UsuarioForm): Promise<R> {
  const eu = await exigirPermissao("gerirUsuarios");
  const parsed = usuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const d = parsed.data;

  const alvo = await carregarAlvo(id);
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (!podeGerirUsuarioCom(eu.perfis, alvo.perfis) || !podeGerirUsuarioCom(eu.perfis, d.perfis)) {
    return semPermissao();
  }
  const motivo = await motivoNaoPodeRestringir(eu, id, alvo.perfis, d);
  if (motivo) return { ok: false, erro: motivo };

  try {
    await db().query(
      `update usuarios set nome = $1, email = $2, perfis = $3, ativo = $4,
              acesso_expira_em = ${expira(5)}, updated_by = $6
        where id_usuario = $7`,
      [d.nome, d.email, d.perfis, d.ativo, d.acesso_expira_em, eu.id_usuario, id],
    );
  } catch (e) {
    return erroBanco(e, "Não foi possível salvar as alterações.");
  }
  // Perfis ou acesso mudaram: as sessões abertas são refeitas no próximo login.
  if (!d.ativo || d.acesso_expira_em || alvo.perfis.join() !== d.perfis.join()) {
    if (id !== eu.id_usuario) await encerrarSessoesDoUsuario(id);
  }
  return { ok: true };
}

/** Regras que impedem alguém de se trancar fora ou de deixar o sistema sem admin. */
async function motivoNaoPodeRestringir(
  eu: UsuarioAtual,
  id: string,
  perfisAtuais: string[],
  novo: { ativo: boolean; perfis: string[]; acesso_expira_em: string | null },
): Promise<string | null> {
  if (id === eu.id_usuario) {
    if (!novo.ativo) return "Você não pode inativar a própria conta.";
    if (novo.acesso_expira_em) return "Você não pode limitar o próprio acesso.";
    if (perfisAtuais.includes("admin") && !novo.perfis.includes("admin")) {
      return "Você não pode remover o próprio perfil de Administrador.";
    }
  }
  const deixaDeSerAdminAtivo =
    perfisAtuais.includes("admin") &&
    (!novo.ativo || !novo.perfis.includes("admin") || !!novo.acesso_expira_em);
  if (deixaDeSerAdminAtivo && !(await outroAdminAtivo(id))) {
    return "Não é possível: este é o último Administrador ativo.";
  }
  return null;
}

export async function definirStatusUsuario(id: string, ativo: boolean): Promise<R> {
  const eu = await exigirPermissao("gerirUsuarios");
  const alvo = await carregarAlvo(id);
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (!podeGerirUsuarioCom(eu.perfis, alvo.perfis)) return semPermissao();
  if (!ativo) {
    if (id === eu.id_usuario) return { ok: false, erro: "Você não pode inativar a própria conta." };
    if (alvo.perfis.includes("admin") && !(await outroAdminAtivo(id))) {
      return { ok: false, erro: "Não é possível: este é o último Administrador ativo." };
    }
  }
  await db().query(`update usuarios set ativo = $1, updated_by = $2 where id_usuario = $3`, [ativo, eu.id_usuario, id]);
  if (!ativo) await encerrarSessoesDoUsuario(id);
  return { ok: true };
}

export async function reenviarConvite(id: string): Promise<R> {
  const eu = await exigirPermissao("gerirUsuarios");
  const alvo = await carregarAlvo(id);
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (!podeGerirUsuarioCom(eu.perfis, alvo.perfis)) return semPermissao();
  if (!alvo.ativo) return { ok: false, erro: "Ative o usuário antes de reenviar o convite." };
  const r = await enviarConvite(id);
  return r.ok ? { ok: true, aviso: "Convite reenviado." } : r;
}

/** Administrador: manda um e-mail de teste para si mesmo para conferir a configuração do envio. */
export async function testarEnvioEmail(): Promise<R> {
  const eu = await exigirPermissao("gerirUsuarios");
  if (!eu.perfis.includes("admin")) return semPermissao();
  try {
    await enviarEmail(emailTeste(eu.email, eu.nome));
  } catch (e) {
    return { ok: false, erro: `O envio falhou: ${e instanceof Error ? e.message : "erro desconhecido"}` };
  }
  return emailSimulado()
    ? { ok: true, aviso: "Envio simulado: o e-mail de teste apareceu só no log do servidor. Falta configurar o Resend (RESEND_API_KEY)." }
    : { ok: true, aviso: `E-mail de teste enviado para ${eu.email}. Confira a caixa de entrada (e o spam).` };
}
