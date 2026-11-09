/**
 * Acesso ao sistema — login sem senha por código, sessões no banco e
 * convites por e-mail. Substitui a sessão JWT + senha (bcrypt) do Gestor e
 * a "identificação só pelo telefone" do Agente de campo.
 *
 * - Usuários (todos os perfis): convite por e-mail → tela /entrar com o
 *   e-mail preenchido → código de 6 dígitos no e-mail → sessão.
 * - Agente de campo: telefone → código (e-mail cadastrado ou SMS) → sessão.
 *
 * A sessão é um token opaco num cookie httpOnly; no banco fica só o hash.
 * Desativar alguém (ou expirar um acesso temporário) derruba o acesso na
 * hora, porque toda leitura de sessão confere o cadastro.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/pool";
import { requireEnv, urlBase } from "@/lib/env";
import {
  CODIGO_JANELA_MIN,
  CODIGO_VALIDADE_MIN,
  MENSAGEM_SITUACAO,
  gerarCodigo,
  gerarToken,
  hashCodigo,
  hashToken,
  hashesIguais,
  motivoBloqueioPedido,
  normalizarCodigo,
  situacaoCodigo,
} from "./codigo";
import { temPermissao, type Permissao } from "./perfis";
import { enviarEmail, enviarSms } from "@/lib/notificacoes/envio";
import { emailCodigo, emailConvite } from "@/lib/notificacoes/modelos";

export const COOKIE_SESSAO = "hub_sessao";
/** "Ver o sistema como": o administrador escolhe um dos perfis cadastrados dele. */
export const COOKIE_VISAO = "hub_visao";

function diasSessao(): number {
  const n = Number(process.env.SESSAO_DIAS ?? "7");
  return Number.isFinite(n) && n > 0 ? n : 7;
}

export interface UsuarioAtual {
  id_usuario: string;
  nome: string;
  email: string;
  /** Perfis em uso (com a "visão" escolhida pelo administrador, só ela). */
  perfis: string[];
  /** Todos os perfis cadastrados da pessoa. */
  perfisCadastrados: string[];
  /** Perfil escolhido em "Ver o sistema como" (só administrador), ou null. */
  visao: string | null;
}

export interface AgenteAtual {
  id_agente: string;
  nome: string;
}

type Sessao =
  | { tipo: "usuario"; usuario: UsuarioAtual }
  | { tipo: "agente"; agente: AgenteAtual };

type Resultado = { ok: true } | { ok: false; erro: string };

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

async function abrirSessao(dono: { id_usuario?: string; id_agente?: string }): Promise<void> {
  const token = gerarToken();
  const dias = diasSessao();
  await db().query(
    `insert into sessoes (token_hash, id_usuario, id_agente, expira_em)
     values ($1, $2, $3, now() + make_interval(days => $4))`,
    [hashToken(token), dono.id_usuario ?? null, dono.id_agente ?? null, dias],
  );
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: dias * 24 * 60 * 60,
  });
}

/** Lê a sessão do cookie, conferindo no banco se o dono ainda pode entrar. */
const lerSessao = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const { rows } = await db().query<{
    id_usuario: string | null;
    u_nome: string | null;
    u_email: string | null;
    u_perfis: string[] | null;
    u_valido: boolean | null;
    id_agente: string | null;
    a_nome: string | null;
    a_ativo: boolean | null;
  }>(
    `select s.id_usuario, u.nome as u_nome, u.email as u_email, u.perfis as u_perfis,
            (u.ativo and (u.acesso_expira_em is null or u.acesso_expira_em > now())) as u_valido,
            s.id_agente, a.nome as a_nome, a.ativo as a_ativo
       from sessoes s
       left join usuarios u on u.id_usuario = s.id_usuario
       left join agentes_campo a on a.id_agente = s.id_agente
      where s.token_hash = $1 and s.expira_em > now()`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r) return null;
  if (r.id_usuario && r.u_valido) {
    const cadastrados = r.u_perfis ?? [];
    // A visão só restringe: vale só para administrador e só para um perfil que ele tem.
    const pedida = (await cookies()).get(COOKIE_VISAO)?.value ?? null;
    const visao = pedida && cadastrados.includes("admin") && cadastrados.includes(pedida) && pedida !== "admin" ? pedida : null;
    return {
      tipo: "usuario",
      usuario: {
        id_usuario: r.id_usuario, nome: r.u_nome!, email: r.u_email!,
        perfis: visao ? [visao] : cadastrados, perfisCadastrados: cadastrados, visao,
      },
    };
  }
  if (r.id_agente && r.a_ativo) {
    return { tipo: "agente", agente: { id_agente: r.id_agente, nome: r.a_nome! } };
  }
  return null;
});

export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  const s = await lerSessao();
  return s?.tipo === "usuario" ? s.usuario : null;
}

export async function agenteAtual(): Promise<AgenteAtual | null> {
  const s = await lerSessao();
  return s?.tipo === "agente" ? s.agente : null;
}

/** Para Server Actions: exige usuário logado com a permissão pedida. */
export async function exigirPermissao(permissao: Permissao): Promise<UsuarioAtual> {
  const u = await usuarioAtual();
  if (!u || !temPermissao(u.perfis, permissao)) throw new Error("Não autorizado");
  return u;
}

/** Para páginas: sem login vai para /entrar; sem permissão volta para /inicio. */
export async function exigirPagina(...permissoes: Permissao[]): Promise<UsuarioAtual> {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  if (!permissoes.some((p) => temPermissao(u.perfis, p))) redirect("/inicio");
  return u;
}

export async function exigirAgente(): Promise<AgenteAtual> {
  const a = await agenteAtual();
  if (!a) throw new Error("Não autorizado");
  return a;
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await db().query(`delete from sessoes where token_hash = $1`, [hashToken(token)]);
  jar.set(COOKIE_SESSAO, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Derruba todas as sessões de um usuário (ex.: ao desativá-lo). */
export async function encerrarSessoesDoUsuario(idUsuario: string): Promise<void> {
  await db().query(`delete from sessoes where id_usuario = $1`, [idUsuario]);
}

export async function encerrarSessoesDoAgente(idAgente: string): Promise<void> {
  await db().query(`delete from sessoes where id_agente = $1`, [idAgente]);
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

type Dono = { coluna: "id_usuario" | "id_agente"; id: string };

async function criarEEnviarCodigo(
  dono: Dono,
  canal: "email" | "sms",
  destino: string,
  nome: string,
): Promise<Resultado> {
  const pool = db();
  const { rows: recentes } = await pool.query<{ criado_em: Date }>(
    `select criado_em from codigos_acesso
      where ${dono.coluna} = $1 and criado_em > now() - make_interval(mins => $2)
      order by criado_em desc`,
    [dono.id, CODIGO_JANELA_MIN],
  );
  const bloqueio = motivoBloqueioPedido(recentes.map((r) => r.criado_em), new Date());
  if (bloqueio) return { ok: false, erro: bloqueio };

  const codigo = gerarCodigo();
  // Um código novo invalida os anteriores ainda não usados.
  await pool.query(
    `update codigos_acesso set usado_em = now() where ${dono.coluna} = $1 and usado_em is null`,
    [dono.id],
  );
  await pool.query(
    `insert into codigos_acesso (${dono.coluna}, canal, destino, codigo_hash, expira_em)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [dono.id, canal, destino, hashCodigo(codigo, requireEnv("SESSION_SECRET")), CODIGO_VALIDADE_MIN],
  );

  try {
    if (canal === "email") await enviarEmail(emailCodigo(destino, nome, codigo));
    else await enviarSms(destino, `Seu codigo de acesso Market Share: ${codigo}. Vale por ${CODIGO_VALIDADE_MIN} min.`);
  } catch (e) {
    console.error("[acesso] falha ao enviar código:", e);
    return { ok: false, erro: "Não foi possível enviar o código agora. Tente de novo em instantes." };
  }
  return { ok: true };
}

async function conferirCodigo(dono: Dono, codigoDigitado: string): Promise<Resultado> {
  const pool = db();
  const { rows } = await pool.query<{
    id_codigo: string; codigo_hash: string; expira_em: Date; usado_em: Date | null; tentativas: number;
  }>(
    `select id_codigo, codigo_hash, expira_em, usado_em, tentativas
       from codigos_acesso where ${dono.coluna} = $1
      order by criado_em desc limit 1`,
    [dono.id],
  );
  const registro = rows[0];
  const situacao = situacaoCodigo(registro, new Date());
  if (situacao !== "valido") return { ok: false, erro: MENSAGEM_SITUACAO[situacao] };

  const digitado = normalizarCodigo(codigoDigitado);
  const confere =
    digitado.length === 6 &&
    hashesIguais(hashCodigo(digitado, requireEnv("SESSION_SECRET")), registro!.codigo_hash);
  if (!confere) {
    await pool.query(`update codigos_acesso set tentativas = tentativas + 1 where id_codigo = $1`, [registro!.id_codigo]);
    return { ok: false, erro: "Código incorreto." };
  }
  // Marca como usado de forma atômica (evita dois logins com o mesmo código).
  const { rowCount } = await pool.query(
    `update codigos_acesso set usado_em = now() where id_codigo = $1 and usado_em is null`,
    [registro!.id_codigo],
  );
  if (!rowCount) return { ok: false, erro: MENSAGEM_SITUACAO.usado };
  return { ok: true };
}

const USUARIO_PODE_ENTRAR = `ativo and (acesso_expira_em is null or acesso_expira_em > now())`;

/**
 * Pede código para um e-mail. Para não revelar quais e-mails existem, a
 * resposta é a mesma para e-mail cadastrado ou não (salvo bloqueio por
 * excesso de pedidos de um e-mail cadastrado).
 */
export async function pedirCodigoUsuario(email: string): Promise<Resultado> {
  const { rows } = await db().query<{ id_usuario: string; nome: string; email: string }>(
    `select id_usuario, nome, email from usuarios where lower(email) = lower($1) and ${USUARIO_PODE_ENTRAR}`,
    [email.trim()],
  );
  const u = rows[0];
  if (!u) return { ok: true };
  return criarEEnviarCodigo({ coluna: "id_usuario", id: u.id_usuario }, "email", u.email, u.nome);
}

export async function entrarComCodigoUsuario(email: string, codigo: string): Promise<Resultado> {
  const { rows } = await db().query<{ id_usuario: string }>(
    `select id_usuario from usuarios where lower(email) = lower($1) and ${USUARIO_PODE_ENTRAR}`,
    [email.trim()],
  );
  const u = rows[0];
  if (!u) return { ok: false, erro: MENSAGEM_SITUACAO.inexistente };
  const r = await conferirCodigo({ coluna: "id_usuario", id: u.id_usuario }, codigo);
  if (!r.ok) return r;
  await db().query(`update usuarios set ultimo_acesso_em = now() where id_usuario = $1`, [u.id_usuario]);
  await abrirSessao({ id_usuario: u.id_usuario });
  return { ok: true };
}

/**
 * Entrada única (/entrar): diz se o e-mail é de alguém da equipe, de um
 * agente de campo ou dos dois, para mandar o código e abrir a tela certa.
 */
export async function tiposDeAcesso(email: string): Promise<{ equipe: boolean; agente: boolean }> {
  const e = email.trim();
  const [{ rows: u }, { rows: a }] = await Promise.all([
    db().query(`select 1 from usuarios where lower(email) = lower($1) and ${USUARIO_PODE_ENTRAR}`, [e]),
    db().query(`select 1 from agentes_campo where lower(email) = lower($1) and ativo and excluido_em is null`, [e]),
  ]);
  return { equipe: u.length > 0, agente: a.length > 0 };
}

const MSG_EMAIL_NAO_LOCALIZADO =
  "E-mail não localizado. Verifique o e-mail informado ou entre em contato com o responsável.";

/** Agente: pede código pelo e-mail cadastrado (mesma mensagem para inexistente e inativo). */
export async function pedirCodigoAgente(email: string): Promise<Resultado> {
  const { rows } = await db().query<{ id_agente: string; nome: string; email: string }>(
    `select id_agente, nome, email from agentes_campo where lower(email) = lower($1) and ativo and excluido_em is null`,
    [email.trim()],
  );
  const a = rows[0];
  if (!a) return { ok: false, erro: MSG_EMAIL_NAO_LOCALIZADO };
  return criarEEnviarCodigo({ coluna: "id_agente", id: a.id_agente }, "email", a.email, a.nome);
}

export async function entrarComCodigoAgente(email: string, codigo: string): Promise<Resultado & { idAgente?: string }> {
  const { rows } = await db().query<{ id_agente: string }>(
    `select id_agente from agentes_campo where lower(email) = lower($1) and ativo and excluido_em is null`,
    [email.trim()],
  );
  const a = rows[0];
  if (!a) return { ok: false, erro: MSG_EMAIL_NAO_LOCALIZADO };
  const r = await conferirCodigo({ coluna: "id_agente", id: a.id_agente }, codigo);
  if (!r.ok) return r;
  await abrirSessao({ id_agente: a.id_agente });
  return { ok: true, idAgente: a.id_agente };
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

/** Gera um novo link de convite (invalida o anterior) e envia por e-mail. */
export async function enviarConvite(idUsuario: string): Promise<Resultado> {
  const token = gerarToken();
  const { rows } = await db().query<{ nome: string; email: string }>(
    `update usuarios set convite_token_hash = $1, convite_enviado_em = now()
      where id_usuario = $2 returning nome, email`,
    [hashToken(token), idUsuario],
  );
  const u = rows[0];
  if (!u) return { ok: false, erro: "Usuário não encontrado." };
  try {
    await enviarEmail(emailConvite(u.email, u.nome, `${urlBase()}/entrar?convite=${token}`));
  } catch (e) {
    console.error("[acesso] falha ao enviar convite:", e);
    return { ok: false, erro: "Usuário salvo, mas o e-mail de convite não pôde ser enviado. Tente reenviar." };
  }
  return { ok: true };
}

/** E-mail do convite, para preencher a tela de entrada. Não abre sessão. */
export async function emailDoConvite(token: string): Promise<string | null> {
  const { rows } = await db().query<{ email: string }>(
    `select email from usuarios where convite_token_hash = $1 and ${USUARIO_PODE_ENTRAR}`,
    [hashToken(token)],
  );
  return rows[0]?.email ?? null;
}
