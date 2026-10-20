"use server";

/** Recibos do Cliente Oculto: Coordenador de Market Share e administrador aprovam, devolvem e pagam. */
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth/acesso";
import { ErroCO, type Quem } from "@/lib/cliente-oculto/repo";
import { aprovarRecibo, devolverRecibo, marcarReciboPago } from "@/lib/cliente-oculto/recibo";

type R = { ok: true } | { ok: false; erro: string };

async function executar(f: (quem: Quem) => Promise<unknown>): Promise<R> {
  const eu = await exigirPermissao("recibos");
  const quem: Quem = { id_usuario: eu.id_usuario, papel: eu.perfis.includes("admin") ? "admin" : "coordenador" };
  try {
    await f(quem);
  } catch (e) {
    return { ok: false, erro: e instanceof ErroCO ? e.message : "Não foi possível atualizar o recibo." };
  }
  revalidatePath("/gestor/recibos");
  return { ok: true };
}

export async function definirAprovacao(reciboId: string, aprovado: boolean): Promise<R> {
  return executar((quem) => aprovarRecibo(quem, reciboId, aprovado));
}

export async function devolver(reciboId: string, motivo: string): Promise<R> {
  return executar((quem) => devolverRecibo(quem, reciboId, motivo));
}

export async function definirPagamento(reciboId: string, pago: boolean): Promise<R> {
  return executar((quem) => marcarReciboPago(quem, reciboId, pago));
}
