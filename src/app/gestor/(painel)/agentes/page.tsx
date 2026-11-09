import { exigirPagina } from "@/lib/auth/acesso";
import { listarAgentes } from "@/lib/data/gestor";
import GestaoAgentes from "./GestaoAgentes";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  await exigirPagina("auditoriaPesquisa");
  const agentes = await listarAgentes();
  return <GestaoAgentes inicial={agentes} />;
}
