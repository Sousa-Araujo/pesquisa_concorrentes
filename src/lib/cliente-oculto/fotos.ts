/**
 * Fotos de comprovação do Cliente Oculto, ligadas a um pilar da avaliação.
 * O avaliador anexa enquanto pode editar a avaliação; o Coordenador de
 * Market Share e o administrador veem na calibragem e no relatório.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { ErroCO, PILAR_KEYS, type Quem } from "./repo";

const q = (texto: string, params: unknown[] = []) => db().query(texto, params);

/** Depois de reduzida no navegador a foto fica bem abaixo disso. */
const TAMANHO_MAXIMO = 700_000;
const MAX_POR_AVALIACAO = 40;
const FORMATO = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

async function exigirAcessoFoto(quem: Quem, avaliacaoId: string, paraEditar: boolean) {
  const { rows: [a] } = await q(
    `select avaliador_id, status, calibragem_aberta from co_avaliacoes where id = $1 and not excluida`,
    [avaliacaoId],
  );
  if (!a || (quem.papel === "avaliador" && a.avaliador_id !== quem.id_usuario)) {
    throw new ErroCO(404, "Avaliação não encontrada");
  }
  if (paraEditar && quem.papel === "avaliador") {
    const pode = a.status === "Em Preenchimento" || (a.status === "Aguardando Calibragem" && !a.calibragem_aberta);
    if (!pode) throw new ErroCO(409, "Esta avaliação já está em calibragem e não pode mais receber fotos.");
  }
}

export async function listarFotos(avaliacaoId: string) {
  const { rows } = await q(
    `select id, pilar_key, legenda, criado_em from co_fotos where avaliacao_id = $1 order by criado_em, id`,
    [avaliacaoId],
  );
  return rows.map((r) => ({
    id: r.id, pilarKey: r.pilar_key, legenda: r.legenda ?? "", criadoEm: r.criado_em, url: `/api/co/fotos/${r.id}`,
  }));
}

export async function adicionarFoto(quem: Quem, avaliacaoId: string, c: Record<string, unknown>) {
  await exigirAcessoFoto(quem, avaliacaoId, true);
  const pilar = c.pilarKey ? String(c.pilarKey) : null;
  if (pilar && !(PILAR_KEYS as readonly string[]).includes(pilar)) throw new ErroCO(400, "Pilar inválido.");
  const m = typeof c.imagem === "string" ? c.imagem.match(FORMATO) : null;
  if (!m) throw new ErroCO(400, "Envie uma foto JPG, PNG ou WebP.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > TAMANHO_MAXIMO) throw new ErroCO(413, "Foto grande demais. Tente de novo.");
  const { rows: [n] } = await q(`select count(*)::int as n from co_fotos where avaliacao_id = $1`, [avaliacaoId]);
  if (n.n >= MAX_POR_AVALIACAO) throw new ErroCO(409, `Limite de ${MAX_POR_AVALIACAO} fotos por avaliação.`);
  const legenda = String(c.legenda ?? "").trim().slice(0, 300) || null;
  await q(
    `insert into co_fotos (avaliacao_id, pilar_key, legenda, mime, imagem, tamanho, criado_por)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [avaliacaoId, pilar, legenda, m[1], bytes, bytes.length, quem.id_usuario],
  );
  return listarFotos(avaliacaoId);
}

async function avaliacaoDaFoto(fotoId: number): Promise<string> {
  const { rows: [f] } = await q(`select avaliacao_id from co_fotos where id = $1`, [fotoId]);
  if (!f) throw new ErroCO(404, "Foto não encontrada");
  return f.avaliacao_id;
}

export async function atualizarLegenda(quem: Quem, avaliacaoId: string, fotoId: number, legenda: unknown) {
  if ((await avaliacaoDaFoto(fotoId)) !== avaliacaoId) throw new ErroCO(404, "Foto não encontrada");
  await exigirAcessoFoto(quem, avaliacaoId, true);
  await q(`update co_fotos set legenda = $2 where id = $1`, [fotoId, String(legenda ?? "").trim().slice(0, 300) || null]);
  return listarFotos(avaliacaoId);
}

export async function removerFoto(quem: Quem, avaliacaoId: string, fotoId: number) {
  if ((await avaliacaoDaFoto(fotoId)) !== avaliacaoId) throw new ErroCO(404, "Foto não encontrada");
  await exigirAcessoFoto(quem, avaliacaoId, true);
  await q(`delete from co_fotos where id = $1`, [fotoId]);
  return listarFotos(avaliacaoId);
}

/** A imagem em si, para a tag <img> (com a mesma regra de acesso da avaliação). */
export async function lerFoto(quem: Quem, fotoId: number) {
  const avaliacaoId = await avaliacaoDaFoto(fotoId);
  await exigirAcessoFoto(quem, avaliacaoId, false);
  const { rows: [f] } = await q(`select mime, imagem from co_fotos where id = $1`, [fotoId]);
  return { mime: f.mime as string, imagem: f.imagem as Buffer };
}
