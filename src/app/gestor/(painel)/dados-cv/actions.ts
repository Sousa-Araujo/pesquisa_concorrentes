"use server";

/** Ligação dos empreendimentos com o CV e sincronização manual (só administrador). */
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/acesso";
import { db } from "@/lib/db/pool";
import { sincronizarSousaCV, type SincronizacaoCV } from "@/lib/data/sousaCV";

async function exigirAdmin() {
  const u = await usuarioAtual();
  if (!u || !u.perfis.includes("admin")) throw new Error("Não autorizado");
}

/** idCv vazio = volta para a ligação automática pelo nome. */
export async function salvarLigacao(idEmpreendimento: number, idCv: string): Promise<SincronizacaoCV> {
  await exigirAdmin();
  if (idCv === "auto") {
    await db().query(`update empreendimentos set id_cv_manual = false where id_empreendimento = $1`, [idEmpreendimento]);
  } else {
    const id = idCv ? Number(idCv) : null;
    await db().query(`update empreendimentos set id_cv = $2, id_cv_manual = true where id_empreendimento = $1`, [idEmpreendimento, id]);
  }
  const r = await sincronizarSousaCV();
  revalidatePath("/gestor/dados-cv");
  return r;
}

export async function sincronizarAgora(): Promise<SincronizacaoCV> {
  await exigirAdmin();
  const r = await sincronizarSousaCV();
  revalidatePath("/gestor/dados-cv");
  return r;
}
