/** O PDF do comitê enviado (para ver ao lado da leitura na conferência). */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { lerArquivoComite } from "@/lib/data/comite";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!temPermissao(u.perfis, "comiteVendas")) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await ctx.params;
  const a = await lerArquivoComite(id);
  if (!a) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(a.bytes), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"`,
      // O comitê é de uso interno (o próprio PDF proíbe enviar ao mercado): nada de cache compartilhado.
      "Cache-Control": "private, no-store",
    },
  });
}
