import { redirect } from "next/navigation";
import { emailDoConvite, usuarioAtual } from "@/lib/auth/acesso";
import FormEntrar from "./FormEntrar";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  if (await usuarioAtual()) redirect("/inicio");
  const searchParams = await searchParamsPromise;
  // O link do convite só preenche o e-mail — quem entra é quem recebe o código.
  const emailConvite = searchParams.convite ? await emailDoConvite(searchParams.convite) : null;
  return <FormEntrar emailInicial={emailConvite ?? ""} veioDeConvite={!!emailConvite} />;
}
