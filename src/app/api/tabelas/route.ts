/**
 * Envio da tabela/espelho (PDF ou imagem) de um concorrente: guarda o
 * arquivo e devolve o id. A leitura pela IA é o segundo passo
 * (POST /api/tabelas/[id]/ler), para a tela mostrar as etapas.
 */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { criarLeitura } from "@/lib/data/tabelas";
import { db } from "@/lib/db/pool";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!temPermissao(u.perfis, "tabelasEnviar")) return NextResponse.json({ error: "Sem permissão para enviar tabelas." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const idConcorrente = Number(form?.get("idConcorrente"));
  const mes = String(form?.get("mes") ?? "");
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Escolha o arquivo da tabela ou o print do espelho." }, { status: 400 });
  if (!TIPOS.includes(arquivo.type)) return NextResponse.json({ error: "Envie um PDF ou uma imagem (PNG, JPG ou WebP)." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });
  if (!Number.isInteger(idConcorrente) || idConcorrente <= 0) return NextResponse.json({ error: "Escolha o concorrente." }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Escolha o mês." }, { status: 400 });

  const { rows: [c] } = await db().query(`select 1 from concorrentes where id_concorrente = $1 and ativo`, [idConcorrente]);
  if (!c) return NextResponse.json({ error: "Concorrente não encontrado." }, { status: 400 });

  const id = await criarLeitura({
    idConcorrente, mesAno: `${mes}-01`, nome: arquivo.name || "documento", mime: arquivo.type,
    bytes: Buffer.from(await arquivo.arrayBuffer()), idUsuario: u.id_usuario,
  });
  return NextResponse.json({ id }, { status: 201 });
}
