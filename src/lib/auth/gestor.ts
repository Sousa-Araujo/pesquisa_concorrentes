/**
 * Autorização do Gestor (seções 3 e 40) — substitui src/lib/supabase/gestor.ts.
 * Lê o cookie de sessão própria (ver session.ts) e confere no banco se o
 * gestor ainda existe e está ativo.
 */
import { cookies } from "next/headers";
import { db } from "@/lib/db/pool";
import { COOKIE_SESSAO, verificarSessao } from "./session";

export interface GestorAtual {
  id_gestor: string;
  nome: string;
  email: string;
}

/** Retorna o gestor autenticado e ativo, ou null. */
export async function gestorAtual(): Promise<GestorAtual | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const idGestor = await verificarSessao(token);
  if (!idGestor) return null;

  const { rows } = await db().query<{
    id_gestor: string;
    nome: string;
    email: string;
    ativo: boolean;
  }>(`select id_gestor, nome, email, ativo from gestores where id_gestor = $1`, [idGestor]);

  const gestor = rows[0];
  if (!gestor || !gestor.ativo) return null;
  return { id_gestor: gestor.id_gestor, nome: gestor.nome, email: gestor.email };
}
