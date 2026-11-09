import { exigirPagina } from "@/lib/auth/acesso";
import { listarEmpreendimentosAdmin } from "@/lib/data/gestor";
import { listarRegionais, listarCidades } from "@/lib/data/hierarquia";
import GestaoEmpreendimentos from "./GestaoEmpreendimentos";

export const dynamic = "force-dynamic";

export default async function EmpreendimentosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ regional?: string; cidade?: string }>;
}) {
  await exigirPagina("cadastros");
  const searchParams = await searchParamsPromise;
  const regional = searchParams.regional ?? "";
  const idCidade = searchParams.cidade ?? "";

  const [regionais, itens] = await Promise.all([
    listarRegionais(),
    listarEmpreendimentosAdmin({
      regional: regional || undefined,
      idCidade: idCidade ? Number(idCidade) : undefined,
    }),
  ]);
  const cidades = regional ? await listarCidades(regional) : [];

  return (
    <GestaoEmpreendimentos
      regional={regional}
      idCidade={idCidade}
      regionais={regionais.map((r) => r.regional)}
      cidades={cidades.map((c) => ({ id: c.id_cidade, nome: c.cidade }))}
      itens={itens}
    />
  );
}
