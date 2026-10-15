/**
 * API do Cliente Oculto — mesmas rotas do `server.js` do app antigo, agora
 * sob /api/co e usando o login e os perfis do sistema unificado.
 *
 * Papel no módulo: Administrador → admin; Coordenador de Market Share →
 * coordenador; Avaliador → avaliador (ver papelCO). `admin` passa em
 * qualquer rota.
 */
import { NextResponse, type NextRequest } from "next/server";
import { encerrarSessao, usuarioAtual } from "@/lib/auth/acesso";
import * as co from "@/lib/cliente-oculto/repo";
import { ErroCO, papelCO, type PapelCO, type Quem } from "@/lib/cliente-oculto/repo";

export const dynamic = "force-dynamic";

type Corpo = Record<string, unknown>;
interface Rota {
  metodo: "GET" | "POST" | "PUT" | "DELETE";
  re: RegExp;
  /** Papéis permitidos além de admin. Omitido = qualquer papel do módulo. */
  papeis?: PapelCO[];
  h: (quem: Quem, m: RegExpMatchArray, corpo: Corpo, query: Record<string, string>) => Promise<unknown>;
  status?: number;
}

const ID = "([^/]+)";
const rotas: Rota[] = [
  { metodo: "GET", re: /^avaliacoes$/, h: (u, _m, _c, qs) => co.listarAvaliacoes(u, qs) },
  { metodo: "POST", re: /^avaliacoes$/, papeis: ["avaliador"], status: 201, h: (u) => co.criarAvaliacao(u) },
  { metodo: "GET", re: new RegExp(`^avaliacoes/${ID}$`), h: (u, m) => co.obterAvaliacao(u, m[1]) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/identificacao$`), papeis: ["avaliador"], h: (u, m, c) => co.atualizarIdentificacao(u, m[1], c) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/pilares/${ID}/informada$`), papeis: ["avaliador"], h: (u, m, c) => co.atualizarPilarInformada(u, m[1], m[2], c) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/jornada/${ID}$`), papeis: ["avaliador"], h: (u, m, c) => co.atualizarJornada(u, m[1], m[2], c.status) },
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/finalizar$`), papeis: ["avaliador"], h: (u, m) => co.finalizar(u, m[1]) },

  // Vínculo Sousa x Concorrente
  { metodo: "GET", re: new RegExp(`^avaliacoes/${ID}/opcoes-vinculo$`), h: (u, m) => co.opcoesVinculo(u, m[1]) },
  { metodo: "GET", re: new RegExp(`^avaliacoes/${ID}/concorrentes$`), papeis: ["coordenador"], h: (u, m) => co.concorrentesVinculados(u, m[1]) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/vinculo$`), papeis: ["coordenador"], h: (u, m, c) => co.atualizarVinculoCoord(u, m[1], c) },

  // Coordenador de Market Share — etapa 2
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/abrir-calibragem$`), papeis: ["coordenador"], h: (u, m) => co.abrirCalibragem(u, m[1]) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/pilares/${ID}/calibragem$`), papeis: ["coordenador"], h: (u, m, c) => co.atualizarCalibragem(u, m[1], m[2], c) },
  { metodo: "PUT", re: new RegExp(`^avaliacoes/${ID}/jornada/${ID}/calibragem$`), papeis: ["coordenador"], h: (u, m, c) => co.atualizarJornadaCalibrada(u, m[1], m[2], c.statusCalibrado) },
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/gaps$`), papeis: ["coordenador"], status: 201, h: (u, m, c) => co.adicionarGap(u, m[1], c) },
  { metodo: "DELETE", re: new RegExp(`^avaliacoes/${ID}/gaps/(\\d+)$`), papeis: ["coordenador"], h: (u, m) => co.removerGap(u, m[1], Number(m[2])) },
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/concluir$`), papeis: ["coordenador"], h: (u, m) => co.concluir(u, m[1]) },

  // Administrador
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/excluir$`), papeis: [], h: (u, m) => co.excluir(u, m[1]) },
  { metodo: "POST", re: new RegExp(`^avaliacoes/${ID}/restaurar$`), papeis: [], h: (u, m) => co.restaurar(u, m[1]) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/identificacao$`), papeis: [], h: (u, m, c) => co.adminAtualizarIdentificacao(u, m[1], c) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/pilares/${ID}$`), papeis: [], h: (u, m, c) => co.adminAtualizarPilar(u, m[1], m[2], c) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/jornada/${ID}$`), papeis: [], h: (u, m, c) => co.adminAtualizarJornada(u, m[1], m[2], c) },
  { metodo: "POST", re: new RegExp(`^admin/avaliacoes/${ID}/gaps$`), papeis: [], status: 201, h: (u, m, c) => co.adminAdicionarGap(u, m[1], c) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/gaps/(\\d+)$`), papeis: [], h: (u, m, c) => co.adminAtualizarGap(u, m[1], Number(m[2]), c) },
  { metodo: "DELETE", re: new RegExp(`^admin/avaliacoes/${ID}/gaps/(\\d+)$`), papeis: [], h: (u, m) => co.adminRemoverGap(u, m[1], Number(m[2])) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/status$`), papeis: [], h: (u, m, c) => co.adminAtualizarStatus(u, m[1], c.status) },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/calibragem-aberta$`), papeis: [], h: (u, m, c) => co.adminAtualizarCalibragemAberta(u, m[1], c.aberta === true || c.aberta === "true") },
  { metodo: "PUT", re: new RegExp(`^admin/avaliacoes/${ID}/vinculo$`), papeis: [], h: (u, m, c) => co.adminAtualizarVinculo(u, m[1], c) },
];

function json(status: number, dados: unknown) {
  return NextResponse.json(dados, { status });
}

async function tratar(req: NextRequest, ctx: { params: Promise<{ rota: string[] }> }, metodo: Rota["metodo"]) {
  const caminho = (await ctx.params).rota.map(decodeURIComponent).join("/");

  // Sessão (login fica em /entrar; aqui só "quem sou eu" e sair).
  if (caminho === "auth/logout" && metodo === "POST") {
    await encerrarSessao();
    return json(200, { ok: true });
  }
  const usuario = await usuarioAtual();
  if (!usuario) return json(401, { error: "Sessão expirada ou inválida. Faça login novamente." });
  const papel = papelCO(usuario.perfis);
  if (!papel) return json(403, { error: "Seu perfil não tem acesso ao Cliente Oculto." });
  if (caminho === "auth/me" && metodo === "GET") {
    return json(200, { nome: usuario.nome, email: usuario.email, papel });
  }

  const rota = rotas.find((r) => r.metodo === metodo && r.re.test(caminho));
  if (!rota) return json(404, { error: "Rota não encontrada" });
  if (rota.papeis && papel !== "admin" && !rota.papeis.includes(papel)) {
    return json(403, { error: "Você não tem permissão para executar esta ação." });
  }

  let corpo: Corpo = {};
  if (metodo === "POST" || metodo === "PUT") {
    const texto = await req.text();
    if (texto.length > 1_000_000) return json(413, { error: "Corpo da requisição muito grande" });
    if (texto) {
      try { corpo = JSON.parse(texto); } catch { return json(400, { error: "JSON inválido no corpo da requisição" }); }
    }
  }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const dados = await rota.h({ id_usuario: usuario.id_usuario, papel }, caminho.match(rota.re)!, corpo, query);
    return json(rota.status ?? 200, dados);
  } catch (e) {
    if (e instanceof ErroCO) return json(e.status, { error: e.message });
    console.error("[api/co] erro:", e);
    return json(500, { error: "Erro interno. Tente de novo." });
  }
}

type Ctx = { params: Promise<{ rota: string[] }> };
export const GET = (req: NextRequest, ctx: Ctx) => tratar(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => tratar(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Ctx) => tratar(req, ctx, "PUT");
export const DELETE = (req: NextRequest, ctx: Ctx) => tratar(req, ctx, "DELETE");
