/**
 * Segundo passo do envio (e o "Ler de novo com IA"): pede a leitura à IA do
 * arquivo já guardado. Separado do upload para a tela mostrar as etapas
 * "Arquivo recebido" e "IA lendo o arquivo".
 */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { obterLeitura, processarLeitura } from "@/lib/data/tabelas";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!temPermissao(u.perfis, "tabelasEnviar") && !temPermissao(u.perfis, "tabelasConferir")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  const l = await obterLeitura(id);
  if (!l) return NextResponse.json({ error: "Leitura não encontrada." }, { status: 404 });
  if (l.status !== "lendo" && l.status !== "para_conferir") {
    return NextResponse.json({ error: "Esta leitura já foi conferida." }, { status: 409 });
  }
  await processarLeitura(id);
  const depois = await obterLeitura(id);
  return NextResponse.json({ id, erroIa: depois?.erroIa ?? null });
}
