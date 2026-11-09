import { exigirPagina } from "@/lib/auth/acesso";
import { listarConcorrentesAdmin } from "@/lib/data/gestor";
import { listarRegionais, listarCidades, listarEmpreendimentos } from "@/lib/data/hierarquia";
import GestaoConcorrentes from "./GestaoConcorrentes";

export const dynamic = "force-dynamic";

export default async function ConcorrentesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ regional?: string; cidade?: string; emp?: string }>;
}) {
  await exigirPagina("cadastros");
  const searchParams = await searchParamsPromise;
  const regional = searchParams.regional ?? "";
  const idCidade = searchParams.cidade ?? "";
  const idEmp = searchParams.emp ?? "";

  const [regionais, itens] = await Promise.all([
    listarRegionais(),
    listarConcorrentesAdmin({
      regional: regional || undefined,
      idCidade: idCidade ? Number(idCidade) : undefined,
      idEmpreendimento: idEmp ? Number(idEmp) : undefined,
    }),
  ]);
  const cidades = regional ? await listarCidades(regional) : [];
  const emps = idCidade ? await listarEmpreendimentos(Number(idCidade)) : [];

  return (
    <GestaoConcorrentes
      regional={regional}
      idCidade={idCidade}
      idEmp={idEmp}
      regionais={regionais.map((r) => r.regional)}
      cidades={cidades.map((c) => ({ id: c.id_cidade, nome: c.cidade }))}
      emps={emps.map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento }))}
      itens={itens}
    />
  );
}
