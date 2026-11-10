/**
 * Envio do PDF do Comitê de Vendas (só administrador): guarda o arquivo com a
 * vigência informada e devolve o id. A leitura pela IA é o segundo passo
 * (POST /api/comite/[id]/ler), para a tela mostrar as etapas.
 */
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/acesso";
import { temPermissao } from "@/lib/auth/perfis";
import { criarComite } from "@/lib/data/comite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const ehData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export async function POST(req: NextRequest) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!temPermissao(u.perfis, "comiteVendas")) return NextResponse.json({ error: "Só o administrador envia o comitê de vendas." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const inicio = String(form?.get("vigenciaInicio") ?? "");
  const fim = String(form?.get("vigenciaFim") ?? "");

  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Escolha o PDF do comitê." }, { status: 400 });
  if (arquivo.type !== "application/pdf") return NextResponse.json({ error: "Envie o comitê em PDF." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });
  if (!ehData(inicio) || !ehData(fim)) return NextResponse.json({ error: "Informe a vigência (início e fim) das condições deste comitê." }, { status: 400 });
  if (inicio > fim) return NextResponse.json({ error: "O início da vigência não pode ser depois do fim." }, { status: 400 });

  const id = await criarComite({
    vigenciaInicio: inicio, vigenciaFim: fim, nome: arquivo.name || "comite.pdf", mime: arquivo.type,
    bytes: Buffer.from(await arquivo.arrayBuffer()), idUsuario: u.id_usuario,
  });
  return NextResponse.json({ id }, { status: 201 });
}
