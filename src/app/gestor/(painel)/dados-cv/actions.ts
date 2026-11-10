"use server";

/** Ligação dos empreendimentos com o CV e sincronização manual (só administrador). */
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/acesso";
import { db } from "@/lib/db/pool";
import { gravarPreenchimento, previaPreenchimento, sincronizarSousaCV, type ItemPreenchimento, type SincronizacaoCV } from "@/lib/data/sousaCV";

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

/** Prévia do preenchimento de um mês já fechado (não grava). */
export async function conferirMes(mes: string): Promise<{ ok: true; itens: ItemPreenchimento[] } | { ok: false; erro: string }> {
  await exigirAdmin();
  try {
    return { ok: true, itens: await previaPreenchimento(mes) };
  } catch (e) {
    console.error("[cv] prévia do preenchimento:", e);
    return { ok: false, erro: e instanceof Error && e.message.startsWith("Escolha") ? e.message : "Não foi possível ler o BI do CV agora." };
  }
}

/** Cria as linhas que faltam no mês (as digitadas à mão não mudam). */
export async function preencherMes(mes: string): Promise<{ ok: boolean; mensagem: string }> {
  await exigirAdmin();
  try {
    const n = await gravarPreenchimento(mes);
    revalidatePath("/gestor/dados-cv");
    revalidatePath("/gestor/comparativo");
    revalidatePath("/gestor");
    return { ok: true, mensagem: n === 0 ? "Nada a preencher: todos os empreendimentos já têm dado nesse mês." : `${n} empreendimento(s) preenchido(s) com os dados do CV.` };
  } catch (e) {
    console.error("[cv] preenchimento:", e);
    return { ok: false, mensagem: "Não foi possível preencher o mês agora." };
  }
}

export async function sincronizarAgora(): Promise<SincronizacaoCV> {
  await exigirAdmin();
  const r = await sincronizarSousaCV();
  revalidatePath("/gestor/dados-cv");
  return r;
}
