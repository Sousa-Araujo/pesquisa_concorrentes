"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Comite, StatusComite } from "@/lib/data/comite";
import { confirmar } from "@/lib/cliente/dialogo";
import { excluir } from "./[id]/actions";

export const STATUS_COMITE: Record<StatusComite, { rotulo: string; cor: string }> = {
  lendo: { rotulo: "Lendo", cor: "bg-[var(--surface-2)] text-ink/60" },
  para_conferir: { rotulo: "Para conferir", cor: "bg-[var(--warning-tint)] text-[var(--warning-ink)]" },
  aprovado: { rotulo: "Aprovado", cor: "bg-[var(--good-tint)] text-[var(--good-ink)]" },
  recusado: { rotulo: "Recusado", cor: "bg-[var(--critical-tint)] text-[var(--critical-ink)]" },
};

export const dataBR = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

export default function ListaComites({ comites }: { comites: Comite[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  async function fazerExcluir(c: Comite) {
    const ok = await confirmar({
      titulo: `Excluir o comitê de ${dataBR(c.vigenciaInicio)} a ${dataBR(c.vigenciaFim)}?`,
      mensagem: c.status === "aprovado"
        ? "Ele já foi aprovado: o Quadro Comparativo volta a usar os dados da visita do Cliente Oculto. O PDF enviado também é apagado."
        : "O PDF enviado também é apagado.",
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    iniciar(async () => { await excluir(c.id); router.refresh(); });
  }

  return (
    <section className="grid gap-3" aria-label="Comitês enviados">
      <h2 className="text-base font-bold text-ink">Comitês enviados</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Vigência</th>
              <th className="px-4 py-3 font-medium">Arquivo</th>
              <th className="px-4 py-3 text-right font-medium">Produtos</th>
              <th className="px-4 py-3 font-medium">Enviado</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comites.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/50">Nenhum comitê enviado ainda.</td></tr>
            )}
            {comites.map((c) => {
              const st = STATUS_COMITE[c.status];
              const ligados = c.linhas.filter((l) => !l.ignorar && l.idEmpreendimento).length;
              return (
                <tr key={c.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3 font-medium text-ink">{dataBR(c.vigenciaInicio)} a {dataBR(c.vigenciaFim)}</td>
                  <td className="px-4 py-3 text-ink/70">{c.arquivoNome}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.linhas.length ? <>{c.linhas.length}<span className="block text-xs text-ink/50">{ligados} ligados ao cadastro</span></> : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {new Date(c.enviadoEm).toLocaleDateString("pt-BR")}
                    {c.enviadoPor && <span className="block text-xs text-ink/50">{c.enviadoPor}</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cor}`}>{st.rotulo}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="acoes-linha justify-end">
                      <a className="btn-acao" href={`/gestor/tabelas/comite/${c.id}`}>{c.status === "para_conferir" ? "Conferir" : "Abrir"}</a>
                      <button className="btn-acao btn-acao--perigo !px-2" title="Excluir comitê" aria-label={`Excluir o comitê de ${dataBR(c.vigenciaInicio)}`}
                        disabled={pendente} onClick={() => fazerExcluir(c)}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
