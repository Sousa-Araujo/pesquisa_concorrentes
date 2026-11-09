/**
 * "Ver o sistema como" (engrenagem): o administrador escolhe um dos perfis
 * cadastrados dele para ver o sistema só com aquele perfil; vazio volta a
 * todos. Só restringe — nunca dá um perfil que a pessoa não tem.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_VISAO, usuarioAtual } from "@/lib/auth/acesso";
import { telaInicial } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  if (!u.perfisCadastrados.includes("admin")) return NextResponse.json({ error: "Só o administrador troca a visualização." }, { status: 403 });
  const corpo = (await req.json().catch(() => null)) as { perfil?: unknown } | null;
  const perfil = typeof corpo?.perfil === "string" ? corpo.perfil : "";
  const jar = await cookies();
  if (!perfil || perfil === "admin") {
    jar.set(COOKIE_VISAO, "", { httpOnly: true, path: "/", maxAge: 0 });
    return NextResponse.json({ ok: true, destino: telaInicial(u.perfisCadastrados) ?? "/inicio" });
  }
  if (!u.perfisCadastrados.includes(perfil)) return NextResponse.json({ error: "Você não tem esse perfil." }, { status: 400 });
  jar.set(COOKIE_VISAO, perfil, {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 12 * 60 * 60,
  });
  return NextResponse.json({ ok: true, destino: telaInicial([perfil]) ?? "/inicio" });
}
