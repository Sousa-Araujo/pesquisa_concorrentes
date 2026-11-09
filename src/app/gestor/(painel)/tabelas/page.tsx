/**
 * Tabelas e espelhos: o Supervisor de Parcerias envia o PDF/print do
 * concorrente e acompanha as leituras; quem confere vê as que aguardam.
 */
import { exigirPagina } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { listarRegionais } from "@/lib/data/hierarquia";
import { listarLeituras } from "@/lib/data/tabelas";
import { iaConfigurada } from "@/lib/ia/leitura";
import { competenciaVigente } from "@/lib/domain/competencia";
import EnvioTabela from "./EnvioTabela";
import ListaLeituras from "./ListaLeituras";

export const dynamic = "force-dynamic";

export default async function TabelasPage({ searchParams: sp }: { searchParams: Promise<{ status?: string }> }) {
  const u = await exigirPagina("tabelasEnviar", "tabelasConferir");
  const { status } = await sp;
  const filtro = ["para_conferir", "aprovada", "recusada"].includes(status ?? "") ? status! : "";
  const [regionais, leituras] = await Promise.all([listarRegionais(), listarLeituras({ status: filtro || undefined })]);
  const podeEnviar = temPermissao(u.perfis, "tabelasEnviar");
  const podeConferir = temPermissao(u.perfis, "tabelasConferir");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tabelas e espelhos</h1>
        <p className="text-sm text-ink/50">
          Envie o PDF da tabela ou o print do espelho de vendas do concorrente. A IA lê as unidades e a coordenação confere antes de entrar na Pesquisa.
        </p>
      </div>
      {!iaConfigurada() && (
        <p className="ms-alert ms-alert--info">A leitura por IA ainda não está configurada neste ambiente. O envio funciona e os números podem ser preenchidos na conferência.</p>
      )}
      {podeEnviar && <EnvioTabela regionais={regionais.map((r) => r.regional)} mesInicial={competenciaVigente().slice(0, 7)} podeConferir={podeConferir} />}
      <ListaLeituras leituras={leituras} filtro={filtro} podeExcluir={u.perfis.includes("admin")} podeConferir={podeConferir} />
    </div>
  );
}
