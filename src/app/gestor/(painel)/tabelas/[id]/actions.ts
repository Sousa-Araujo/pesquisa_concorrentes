"use server";

/** Conferência da leitura de tabela: só Coordenador de Market Share e administrador. */
import { revalidatePath } from "next/cache";
import { exigirPermissao, usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { aprovarLeitura, excluirLeitura, obterLeitura, processarLeitura, recusarLeitura, salvarConferencia, type Conferencia, type Leitura } from "@/lib/data/tabelas";

export async function salvar(id: string, c: Conferencia): Promise<Leitura | null> {
  await exigirPermissao("tabelasConferir");
  return salvarConferencia(id, c);
}

export async function aprovar(id: string, c: Conferencia): Promise<{ ok: true } | { ok: false; erro: string }> {
  const eu = await exigirPermissao("tabelasConferir");
  await salvarConferencia(id, c);
  const r = await aprovarLeitura(id, eu.id_usuario);
  revalidatePath("/gestor/tabelas");
  revalidatePath("/gestor/tabelas/conferir");
  return r;
}

/** Quando a IA falhou (sobrecarga, demora), lê o mesmo arquivo de novo. */
export async function lerDeNovo(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const eu = await usuarioAtual();
  if (!eu || !(temPermissao(eu.perfis, "tabelasEnviar") || temPermissao(eu.perfis, "tabelasConferir"))) throw new Error("Não autorizado");
  const l = await obterLeitura(id);
  if (!l || l.status !== "para_conferir") return { ok: false, erro: "Esta leitura não está aguardando conferência." };
  await processarLeitura(id);
  revalidatePath(`/gestor/tabelas/${id}`);
  return { ok: true };
}

export async function recusar(id: string, motivo: string): Promise<{ ok: true }> {
  const eu = await exigirPermissao("tabelasConferir");
  await recusarLeitura(id, eu.id_usuario, motivo);
  revalidatePath("/gestor/tabelas");
  return { ok: true };
}

/** Exclui a leitura (só administrador), com o que ela gravou na Pesquisa se já aprovada. */
export async function excluir(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const eu = await usuarioAtual();
  if (!eu || !eu.perfis.includes("admin")) throw new Error("Não autorizado");
  const r = await excluirLeitura(id);
  revalidatePath("/gestor/tabelas");
  revalidatePath("/gestor/tabelas/conferir");
  return r;
}
