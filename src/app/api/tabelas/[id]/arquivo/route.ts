/** O documento enviado (para ver ao lado da leitura na conferência). */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { lerArquivo } from "@/lib/data/tabelas";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!temPermissao(u.perfis, "tabelasEnviar") && !temPermissao(u.perfis, "tabelasConferir")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const a = await lerArquivo(id);
  if (!a) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(a.bytes), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
