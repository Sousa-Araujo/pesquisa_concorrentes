"use server";

/** Recibos do Cliente Oculto: só o administrador marca como pago por esta tela. */
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth/acesso";
import { ErroCO } from "@/lib/cliente-oculto/repo";
import { marcarReciboPago } from "@/lib/cliente-oculto/recibo";

type R = { ok: true } | { ok: false; erro: string };

export async function definirPagamento(avaliacaoId: string, pago: boolean): Promise<R> {
  const eu = await exigirPermissao("recibos");
  try {
    await marcarReciboPago({ id_usuario: eu.id_usuario, papel: "admin" }, avaliacaoId, pago);
  } catch (e) {
    return { ok: false, erro: e instanceof ErroCO ? e.message : "Não foi possível atualizar o recibo." };
  }
  revalidatePath("/gestor/recibos");
  return { ok: true };
}
