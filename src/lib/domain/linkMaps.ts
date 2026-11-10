/**
 * Link do Google Maps de um concorrente (campo opcional do cadastro). Como o
 * link vira um <a href> nas telas, só entram endereços https do Google Maps
 * (google.com/maps, maps.google.com, maps.app.goo.gl, goo.gl/maps).
 */

export const MENSAGEM_LINK_MAPS = "Link do Google Maps inválido. Cole o endereço copiado do Google Maps (https://maps.app.goo.gl/… ou https://www.google.com/maps/…).";

const TAMANHO_MAXIMO = 600;

function ehGoogleMaps(u: URL): boolean {
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return u.pathname.startsWith("/maps");
  const google = /(^|\.)google\.(com|com\.br)$/.test(host);
  return google && (host.startsWith("maps.") || u.pathname.startsWith("/maps"));
}

/** Vazio = sem link (valor null). Sem "https://" no começo, ele é acrescentado. */
export function lerLinkMaps(entrada: string | null | undefined): { ok: true; valor: string | null } | { ok: false } {
  const texto = String(entrada ?? "").trim();
  if (!texto) return { ok: true, valor: null };
  if (texto.length > TAMANHO_MAXIMO) return { ok: false };
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`);
    return ehGoogleMaps(url) ? { ok: true, valor: url.href } : { ok: false };
  } catch {
    return { ok: false };
  }
}
