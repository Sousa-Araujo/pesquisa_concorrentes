/**
 * Tarefas periódicas do servidor, uma vez por processo (o modo de
 * desenvolvimento recarrega este arquivo):
 *  - sincroniza os dados Sousa com o BI do CV a cada 30 minutos
 *    (src/lib/data/sousaCV.ts);
 *  - apaga sessões vencidas e códigos de acesso antigos a cada 6 horas,
 *    para essas tabelas não crescerem sem fim.
 */
import { db } from "./lib/db/pool";
import { sincronizarSousaCV } from "./lib/data/sousaCV";

const g = globalThis as { __syncCV?: boolean; __limpeza?: boolean };
if (process.env.CV_DATABASE_URL && !g.__syncCV) {
  g.__syncCV = true;
  const rodar = () => { sincronizarSousaCV().catch((e) => console.error("[cv] sincronização agendada:", e)); };
  setTimeout(rodar, 20_000);
  setInterval(rodar, 30 * 60_000);
}

if (process.env.DATABASE_URL && !g.__limpeza) {
  g.__limpeza = true;
  const limpar = async () => {
    try {
      await db().query(`delete from sessoes where expira_em < now()`);
      // Códigos valem 10 minutos; um dia de folga mantém o limite de pedidos funcionando.
      await db().query(`delete from codigos_acesso where criado_em < now() - interval '1 day'`);
    } catch (e) {
      console.error("[limpeza] sessões e códigos:", e);
    }
  };
  setTimeout(limpar, 60_000);
  setInterval(limpar, 6 * 60 * 60_000);
}
