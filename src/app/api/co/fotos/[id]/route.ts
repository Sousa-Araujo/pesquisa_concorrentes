/** Imagem de uma foto do Cliente Oculto (mesma regra de acesso da avaliação). */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { ErroCO, papelCO } from "@/lib/cliente-oculto/repo";
import { lerFoto } from "@/lib/cliente-oculto/fotos";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const papel = papelCO(usuario.perfis);
  if (!papel) return NextResponse.json({ error: "Sem acesso ao Cliente Oculto." }, { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  try {
    const { mime, imagem } = await lerFoto({ id_usuario: usuario.id_usuario, papel }, id);
    return new NextResponse(new Uint8Array(imagem), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    if (e instanceof ErroCO) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
