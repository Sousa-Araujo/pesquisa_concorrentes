"use server";

/**
 * Entrada no sistema (todos os perfis, exceto o agente de campo, que usa
 * /agente): e-mail → código de 6 dígitos enviado ao e-mail → sessão.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { encerrarSessao, entrarComCodigoUsuario, pedirCodigoUsuario } from "@/lib/auth/acesso";

type R = { ok: true } | { ok: false; erro: string };

const emailSchema = z.string().trim().email("Informe um e-mail válido.");

export async function solicitarCodigo(email: string): Promise<R> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  return pedirCodigoUsuario(parsed.data);
}

export async function confirmarCodigo(email: string, codigo: string): Promise<R> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  return entrarComCodigoUsuario(parsed.data, codigo);
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}
