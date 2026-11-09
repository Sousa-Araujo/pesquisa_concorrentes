/** Foto do perfil da pessoa logada (menu do usuário na navbar). */
import { NextResponse } from "next/server";
import { db } from "@/lib/db/pool";
import { usuarioAtual } from "@/lib/auth/acesso";

export const dynamic = "force-dynamic";

/** O navegador já manda a foto reduzida (160px); acima disso não é uma foto de perfil. */
const TAMANHO_MAXIMO = 200_000;
const FORMATO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  const corpo = (await req.json().catch(() => null)) as { foto?: unknown } | null;
  const foto = typeof corpo?.foto === "string" ? corpo.foto : "";
  if (!FORMATO.test(foto) || foto.length > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Envie uma imagem JPG, PNG ou WebP." }, { status: 400 });
  }
  await db().query(`update usuarios set foto = $1 where id_usuario = $2`, [foto, u.id_usuario]);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  await db().query(`update usuarios set foto = null where id_usuario = $1`, [u.id_usuario]);
  return NextResponse.json({ ok: true });
}
