/**
 * Sincroniza os dados Sousa com o BI do CV a cada 30 minutos
 * (src/lib/data/sousaCV.ts). Uma vez por processo: o modo de
 * desenvolvimento recarrega este arquivo.
 */
import { sincronizarSousaCV } from "./lib/data/sousaCV";

const g = globalThis as { __syncCV?: boolean };
if (process.env.CV_DATABASE_URL && !g.__syncCV) {
  g.__syncCV = true;
  const rodar = () => { sincronizarSousaCV().catch((e) => console.error("[cv] sincronização agendada:", e)); };
  setTimeout(rodar, 20_000);
  setInterval(rodar, 30 * 60_000);
}
