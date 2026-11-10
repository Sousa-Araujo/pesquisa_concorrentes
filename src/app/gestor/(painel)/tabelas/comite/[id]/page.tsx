import { notFound } from "next/navigation";
import { exigirPagina } from "@/lib/auth/acesso";
import { cadastroParaComite, obterComite } from "@/lib/data/comite";
import { leituraComiteConfigurada } from "@/lib/ia/comite";
import ConferenciaComite from "./ConferenciaComite";

export const dynamic = "force-dynamic";

export default async function ComiteConferenciaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina("comiteVendas");
  const { id } = await params;
  const comite = await obterComite(id);
  if (!comite) notFound();
  const cadastro = await cadastroParaComite();
  return <ConferenciaComite comite={comite} cadastro={cadastro} iaConfigurada={leituraComiteConfigurada()} />;
}
