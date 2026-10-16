/** Menu lateral do usuário logado — usado pelas telas do Cliente Oculto (public/design/shell.js). */
import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { montarMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  return NextResponse.json(await montarMenu(u));
}
