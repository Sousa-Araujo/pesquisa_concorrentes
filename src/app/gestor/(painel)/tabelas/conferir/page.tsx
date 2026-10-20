/**
 * Tabelas e espelhos → Para conferir: só para quem confere (Coordenador de
 * Market Share e administrador). Lista as leituras que aguardam conferência.
 */
import { exigirPagina } from "@/lib/auth/acesso";
import { listarLeituras } from "@/lib/data/tabelas";
import ListaLeituras from "../ListaLeituras";

export const dynamic = "force-dynamic";

export default async function ParaConferirPage() {
  await exigirPagina("tabelasConferir");
  const leituras = await listarLeituras({ status: "para_conferir" });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Para conferir</h1>
        <p className="text-sm text-ink/50">
          Leituras de tabelas e espelhos aguardando conferência. Abra cada uma, confira com o documento e aprove ou recuse.
        </p>
      </div>
      <ListaLeituras leituras={leituras} filtro={null} titulo={`${leituras.length} ${leituras.length === 1 ? "leitura" : "leituras"} para conferir`} />
    </div>
  );
}
