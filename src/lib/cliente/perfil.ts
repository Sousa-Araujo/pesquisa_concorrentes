/**
 * Preferências da pessoa no navegador (menu do usuário da navbar): tema e
 * foto do perfil. As telas do Cliente Oculto fazem o mesmo em
 * public/design/shell.js — manter os dois iguais.
 */
export const CHAVE_TEMA = "ms-tema";
export type Tema = "light" | "dark";

export function temaAtual(): Tema {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute("data-theme", tema);
  try { localStorage.setItem(CHAVE_TEMA, tema); } catch { /* sem armazenamento */ }
}

/** Reduz a imagem para 160×160 (recorte central) e devolve um JPEG em data URL. */
export function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const lado = 160;
      const c = document.createElement("canvas");
      c.width = lado;
      c.height = lado;
      const m = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

export async function enviarFoto(foto: string): Promise<void> {
  const r = await fetch("/api/perfil/foto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foto }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Não foi possível salvar a foto.");
}
