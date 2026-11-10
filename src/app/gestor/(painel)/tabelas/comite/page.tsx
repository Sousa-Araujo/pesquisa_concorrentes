/**
 * Comitê de vendas (só administrador): envia o PDF mensal do comitê, a IA lê
 * as condições de cada produto e, conferido e aprovado, elas alimentam o
 * Quadro Comparativo (desconto %, parcelas pré e pós-chaves, prazo e entrega).
 */
import Link from "next/link";
import { exigirPagina } from "@/lib/auth/acesso";
import { listarComites } from "@/lib/data/comite";
import { leituraComiteConfigurada } from "@/lib/ia/comite";
import EnvioComite from "./EnvioComite";
import ListaComites from "./ListaComites";

export const dynamic = "force-dynamic";

export default async function ComitePage() {
  await exigirPagina("comiteVendas");
  const comites = await listarComites();
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/gestor/tabelas" className="text-xs font-semibold text-[var(--brand-text)]">← Tabelas e espelhos</Link>
        <h1 className="text-2xl font-bold text-ink">Comitê de vendas</h1>
        <p className="text-sm text-ink/50">
          Envie o PDF mensal do comitê. A IA lê, por produto, o desconto máximo, as parcelas pré e pós-chaves e a previsão de entrega; depois de conferido,
          isso passa a valer na coluna da Sousa do Quadro Comparativo durante a vigência informada.
        </p>
      </div>
      {!leituraComiteConfigurada() && (
        <p className="ms-alert ms-alert--info">A leitura por IA ainda não está configurada neste ambiente (ANTHROPIC_API_KEY). O envio funciona e as linhas podem ser preenchidas na conferência.</p>
      )}
      <EnvioComite />
      <ListaComites comites={comites} />
    </div>
  );
}
