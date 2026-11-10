"use client";

/**
 * Preencher mês anterior com os dados do CV (administrador): mostra a prévia
 * (nada é gravado) e, ao confirmar, cria só as linhas que o Hub ainda não tem.
 * O que foi digitado à mão nunca muda; as diferenças aparecem só para conferência.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import CampoData from "@/components/CampoData";
import { confirmar } from "@/lib/cliente/dialogo";
import type { ItemPreenchimento } from "@/lib/data/sousaCV";
import { conferirMes, preencherMes } from "./actions";

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const mesBR = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

const SITUACAO: Record<ItemPreenchimento["situacao"], { rotulo: string; cor: string }> = {
  novo: { rotulo: "Será criado", cor: "text-[var(--good-ink)]" },
  ja_cv: { rotulo: "Já veio do CV", cor: "text-ink/50" },
  manual_igual: { rotulo: "Digitado, igual ao CV", cor: "text-ink/50" },
  manual_diverge: { rotulo: "Digitado, diferente do CV", cor: "text-[var(--warning-ink)]" },
  sem_cv: { rotulo: "Sem dado no CV", cor: "text-ink/40" },
};

export default function PreencherMeses({ mesPadrao }: { mesPadrao: string }) {
  const router = useRouter();
  const [mes, setMes] = useState(mesPadrao);
  const [itens, setItens] = useState<ItemPreenchimento[] | null>(null);
  const [mesDaPrevia, setMesDaPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const novos = itens?.filter((i) => i.situacao === "novo").length ?? 0;

  function conferir() {
    setErro(null); setAviso(null); setItens(null);
    iniciar(async () => {
      const r = await conferirMes(`${mes}-01`);
      if (!r.ok) { setErro(r.erro); return; }
      setItens(r.itens); setMesDaPrevia(mes);
    });
  }

  async function gravar() {
    if (!mesDaPrevia) return;
    const ok = await confirmar({
      titulo: `Preencher ${mesBR(mesDaPrevia)} com os dados do CV?`,
      mensagem: `${novos} empreendimento(s) sem dado nesse mês ganham uma linha com origem CV. O estoque é uma estimativa (estoque de hoje mais as vendas feitas depois do mês). O que foi digitado à mão não muda.`,
      textoConfirmar: "Preencher",
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await preencherMes(`${mesDaPrevia}-01`);
      if (!r.ok) { setErro(r.mensagem); return; }
      setAviso(r.mensagem); setItens(null);
      router.refresh();
    });
  }

  return (
    <div className="card grid gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Preencher mês anterior com os dados do CV</h2>
        <p className="text-xs text-ink/50">
          Para um mês que já fechou: vendas e ticket com desconto vêm exatos do CV. O estoque é estimado (o CV só guarda a foto de hoje) e o ticket de
          tabela só entra quando a tabela vigente já valia naquele mês. Só cria o que falta; nada digitado é alterado.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="rotulo" htmlFor="pm-mes">Mês</label>
          <CampoData tipo="mes" id="pm-mes" value={mes} onChange={(v) => v && setMes(v)} />
        </div>
        <button className="btn-primary btn-cabecalho" onClick={conferir} disabled={pendente}>
          {pendente ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : null}Conferir no CV
        </button>
        {itens && novos > 0 && (
          <button className="btn-primary btn-cabecalho" onClick={gravar} disabled={pendente}>Preencher {novos} empreendimento(s)</button>
        )}
      </div>
      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
      {aviso && <p className="text-sm text-[var(--good-ink)]" role="status">{aviso}</p>}
      {itens && mesDaPrevia && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="pb-2 text-left text-xs text-ink/50">Prévia de {mesBR(mesDaPrevia)} (nada foi gravado)</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-ink/50">
                <th className="py-2 pr-3 font-medium">Empreendimento</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 text-right font-medium">Hoje no Hub (estoque / vendas)</th>
                <th className="px-3 py-2 text-right font-medium">Pelo CV (estoque / vendas)</th>
                <th className="px-3 py-2 text-right font-medium">Ticket tabela</th>
                <th className="px-3 py-2 text-right font-medium">Ticket c/ desconto</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.idEmpreendimento} className="border-b border-[var(--line)]">
                  <td className="py-2 pr-3 font-medium text-ink">{i.nome}</td>
                  <td className={`px-3 py-2 ${SITUACAO[i.situacao].cor}`}>{SITUACAO[i.situacao].rotulo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.existente ? `${i.existente.estoque} / ${i.existente.vendas}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {i.cv ? `${i.cv.estoque} / ${i.cv.vendas}` : "—"}
                    {i.cv && i.cv.vendasDepois > 0 ? <span className="block text-xs text-ink/50">+{i.cv.vendasDepois} vendidas depois</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(i.cv?.ticketTabelaCentavos ?? null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(i.cv?.ticketDescontoCentavos ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
