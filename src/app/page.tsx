import { redirect } from "next/navigation";
import { agenteAtual, usuarioAtual } from "@/lib/auth/acesso";

export const dynamic = "force-dynamic";

/** Entrada única: quem já tem sessão vai para a sua tela; os demais, para /entrar. */
export default async function Home() {
  if (await usuarioAtual()) redirect("/inicio");
  if (await agenteAtual()) redirect("/agente");
  redirect("/entrar");
}
