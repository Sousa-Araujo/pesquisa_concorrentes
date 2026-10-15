import { exigirPagina } from "@/lib/auth/acesso";
import { competenciaVigente, formatarCompetenciaLonga } from "@/lib/domain/competencia";
import {
  listarRegionais, listarCidades, listarEmpreendimentos,
} from "@/lib/data/hierarquia";
import { obterDadosProprios } from "@/lib/data/gestor";
import FormDadosProprios from "./FormDadosProprios";

export const dynamic = "force-dynamic";

export default async function DadosPropriosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ mes?: string; regional?: string; cidade?: string; emp?: string }>;
}) {
  await exigirPagina("auditoriaPesquisa");
  const searchParams = await searchParamsPromise;
  const mesAno = searchParams.mes ?? competenciaVigente();
  const regional = searchParams.regional ?? "";
  const idCidade = searchParams.cidade ? Number(searchParams.cidade) : undefined;
  const idEmp = searchParams.emp ? Number(searchParams.emp) : undefined;

  const regionais = await listarRegionais();
  const cidades = regional ? await listarCidades(regional) : [];
  const emps = idCidade ? await listarEmpreendimentos(idCidade) : [];
  const atual = idEmp ? await obterDadosProprios(idEmp, mesAno) : null;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Dados próprios do empreendimento</h1>
        <p className="text-sm text-ink/50">
          Estoque e vendas do empreendimento da empresa — competência {formatarCompetenciaLonga(mesAno)}.
        </p>
      </div>

      <FormDadosProprios
        mesAno={mesAno}
        regional={regional}
        idCidade={searchParams.cidade ?? ""}
        idEmp={searchParams.emp ?? ""}
        regionais={regionais.map((r) => r.regional)}
        cidades={cidades.map((c) => ({ id: c.id_cidade, nome: c.cidade }))}
        emps={emps.map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento }))}
        atual={atual ? { estoque: atual.estoque, vendas: atual.vendas } : null}
      />
    </div>
  );
}
