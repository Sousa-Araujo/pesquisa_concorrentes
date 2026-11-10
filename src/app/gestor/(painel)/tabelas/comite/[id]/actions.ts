"use server";

/** Conferência do comitê de vendas: só o administrador. */
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth/acesso";
import { sanearLinhas } from "@/lib/domain/comite";
import { aprovarComite, excluirComite, recusarComite, salvarConferenciaComite } from "@/lib/data/comite";

export async function salvar(id: string, linhas: unknown): Promise<{ ok: true }> {
  await exigirPermissao("comiteVendas");
  await salvarConferenciaComite(id, sanearLinhas(linhas));
  return { ok: true };
}

export async function aprovar(id: string, linhas: unknown): Promise<{ ok: true } | { ok: false; erro: string }> {
  const eu = await exigirPermissao("comiteVendas");
  await salvarConferenciaComite(id, sanearLinhas(linhas));
  const r = await aprovarComite(id, eu.id_usuario);
  revalidatePath("/gestor/tabelas/comite");
  revalidatePath("/gestor/comparativo");
  return r;
}

export async function recusar(id: string, motivo: string): Promise<{ ok: true }> {
  const eu = await exigirPermissao("comiteVendas");
  await recusarComite(id, eu.id_usuario, motivo);
  revalidatePath("/gestor/tabelas/comite");
  return { ok: true };
}

/** Exclui o comitê; se já estava aprovado, o Quadro Comparativo volta a usar a visita do Cliente Oculto. */
export async function excluir(id: string): Promise<{ ok: true }> {
  await exigirPermissao("comiteVendas");
  await excluirComite(id);
  revalidatePath("/gestor/tabelas/comite");
  revalidatePath("/gestor/comparativo");
  return { ok: true };
}
