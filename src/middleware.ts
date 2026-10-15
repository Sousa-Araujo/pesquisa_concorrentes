import { NextResponse, type NextRequest } from "next/server";

/**
 * Barreira rápida: sem cookie de sessão, áreas internas mandam para /entrar.
 * A validação real (sessão no banco, perfil, acesso expirado) acontece nas
 * páginas e Server Actions — aqui só evitamos renderizar o painel à toa.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("hub_sessao")?.value) {
    return NextResponse.redirect(new URL("/entrar", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/inicio", "/gestor", "/gestor/((?!login).*)"],
};
