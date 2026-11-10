/**
 * Segundo passo do envio (e o "Ler de novo com IA"): pede a leitura à IA do
 * PDF já guardado. Separado do upload para a tela mostrar as etapas.
 */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { obterComite, processarComite } from "@/lib/data/comite";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!temPermissao(u.perfis, "comiteVendas")) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const c = await obterComite(id);
  if (!c) return NextResponse.json({ error: "Comitê não encontrado." }, { status: 404 });
  if (c.status !== "lendo" && c.status !== "para_conferir") {
    return NextResponse.json({ error: "Este comitê já foi conferido." }, { status: 409 });
  }
  await processarComite(id);
  const depois = await obterComite(id);
  return NextResponse.json({ id, erroIa: depois?.erroIa ?? null });
}
