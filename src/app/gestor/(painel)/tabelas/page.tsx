/**
 * Tabelas e espelhos: o Supervisor de Parcerias envia o PDF/print do
 * concorrente e acompanha as leituras; quem confere vê as que aguardam.
 */
import { exigirPagina } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { listarRegionais } from "@/lib/data/hierarquia";
import { listarEnvios } from "@/lib/data/tabelas";
import { mesDoParametro } from "@/lib/domain/acompanhamento";
import { iaConfigurada } from "@/lib/ia/leitura";
import { competenciaVigente } from "@/lib/domain/competencia";
import EnvioTabela from "./EnvioTabela";
import AcompanhamentoEnvios from "./AcompanhamentoEnvios";

export const dynamic = "force-dynamic";

export default async function TabelasPage({ searchParams: sp }: { searchParams: Promise<{ mes?: string }> }) {
  const u = await exigirPagina("tabelasEnviar", "tabelasConferir");
  const { mes: mesParam } = await sp;
  const mes = mesDoParametro(mesParam) ?? competenciaVigente();
  const [regionais, envios] = await Promise.all([listarRegionais(), listarEnvios(mes)]);
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
      <AcompanhamentoEnvios linhas={envios} mes={mes} podeExcluir={u.perfis.includes("admin")} podeConferir={podeConferir}>
        {podeEnviar && <EnvioTabela regionais={regionais.map((r) => r.regional)} mesInicial={competenciaVigente().slice(0, 7)} podeConferir={podeConferir} />}
      </AcompanhamentoEnvios>
    </div>
  );
}
