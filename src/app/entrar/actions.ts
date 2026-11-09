"use server";

/**
 * Entrada única no sistema: e-mail → código de 6 dígitos no e-mail → sessão.
 * Serve a equipe (usuários com perfis) e o agente de campo: o sistema
 * descobre pelo e-mail qual é o acesso e abre a tela certa. Se o mesmo
 * e-mail estiver nos dois cadastros, a pessoa escolhe por onde entrar.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  encerrarSessao, entrarComCodigoAgente, entrarComCodigoUsuario, pedirCodigoAgente, pedirCodigoUsuario, tiposDeAcesso,
} from "@/lib/auth/acesso";

export type TipoAcesso = "equipe" | "agente";

const emailSchema = z.string().trim().email("Informe um e-mail válido.");

export async function solicitarCodigo(
  email: string,
  tipo?: TipoAcesso,
): Promise<{ ok: true; tipo: TipoAcesso } | { ok: true; escolher: true } | { ok: false; erro: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const t = await tiposDeAcesso(parsed.data);
  if (!tipo && t.equipe && t.agente) return { ok: true, escolher: true };
  const escolhido: TipoAcesso = tipo ?? (t.agente && !t.equipe ? "agente" : "equipe");
  // E-mail sem cadastro segue o caminho da equipe, que responde igual para não revelar quem existe.
  const r = escolhido === "agente" && t.agente ? await pedirCodigoAgente(parsed.data) : await pedirCodigoUsuario(parsed.data);
  return r.ok ? { ok: true, tipo: escolhido } : r;
}

export async function confirmarCodigo(
  email: string,
  codigo: string,
  tipo: TipoAcesso,
): Promise<{ ok: true; destino: string } | { ok: false; erro: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  if (tipo === "agente") {
    const r = await entrarComCodigoAgente(parsed.data, codigo);
    return r.ok ? { ok: true, destino: "/agente" } : r;
  }
  const r = await entrarComCodigoUsuario(parsed.data, codigo);
  return r.ok ? { ok: true, destino: "/inicio" } : r;
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}
