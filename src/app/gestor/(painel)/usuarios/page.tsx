import { exigirPagina } from "@/lib/auth/acesso";
import { listarUsuarios } from "@/lib/data/gestor";
import GestaoUsuarios from "./GestaoUsuarios";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const eu = await exigirPagina("gerirUsuarios");
  const ehAdmin = eu.perfis.includes("admin");
  const itens = await listarUsuarios(!ehAdmin);
  return <GestaoUsuarios itens={itens} idUsuarioAtual={eu.id_usuario} ehAdmin={ehAdmin} />;
}
