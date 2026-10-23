import { redirect } from "next/navigation";
import { competenciaVigente } from "@/lib/domain/competencia";
import { agenteAtual } from "@/lib/auth/acesso";
import AgenteFluxo from "./AgenteFluxo";

export const dynamic = "force-dynamic";

export default async function AgentePage() {
  // "YYYY-MM" apenas para pré-selecionar o mês; o agente pode trocar.
  const competenciaInicial = competenciaVigente().slice(0, 7);
  const agente = await agenteAtual();
  if (!agente) redirect("/entrar");
  return <AgenteFluxo competenciaInicial={competenciaInicial} agenteInicial={agente} />;
}
