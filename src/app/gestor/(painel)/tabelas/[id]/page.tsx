import { notFound } from "next/navigation";
import { exigirPagina } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { obterLeitura } from "@/lib/data/tabelas";
import { iaConfigurada } from "@/lib/ia/leitura";
import ConferenciaLeitura from "./ConferenciaLeitura";

export const dynamic = "force-dynamic";

export default async function LeituraPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirPagina("tabelasEnviar", "tabelasConferir");
  const { id } = await params;
  const leitura = await obterLeitura(id);
  if (!leitura) notFound();
  const podeConferir = temPermissao(u.perfis, "tabelasConferir") && leitura.status === "para_conferir";
  const podeEditarAprovada = leitura.status === "aprovada" && temPermissao(u.perfis, "tabelasEditarAprovada");
  // A chave remonta a tela (e seus campos) quando uma correção muda os números.
  const chave = `${leitura.mesAno}|${leitura.resumo.estoque}|${leitura.resumo.vendasMes}|${leitura.edicoesAdmin.length}`;
  return <ConferenciaLeitura key={chave} leitura={leitura} podeConferir={podeConferir} iaConfigurada={iaConfigurada()}
    podeExcluir={u.perfis.includes("admin")} podeEditarAprovada={podeEditarAprovada} />;
}
