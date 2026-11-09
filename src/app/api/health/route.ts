/**
 * Healthcheck para o Railway (e outros orquestradores).
 * Propositalmente não consulta o banco: deve responder 200 mesmo que o
 * Postgres esteja indisponível, para não derrubar o deploy por instabilidade
 * externa. A disponibilidade do banco é responsabilidade das rotas que o
 * usam, não do healthcheck de processo.
 */
import { NextResponse } from "next/server";
import { VERSAO } from "@/lib/versao";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", versao: VERSAO });
}
