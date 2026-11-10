"use client";

/**
 * Conferência do comitê de vendas: o PDF de um lado e, do outro, as linhas
 * lidas pela IA (uma por produto), que dá para corrigir. Cada produto é
 * ligado a um empreendimento do cadastro (a IA já sugere pelo nome e pelos
 * apelidos aprendidos). Aprovar grava as condições que o Quadro Comparativo
 * usa; produtos marcados como "ignorar" não entram.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Comite } from "@/lib/data/comite";
import {
  empreendimentosRepetidos, linhaVazia, lerPercentualOuTexto, prazoAteEntrega, problemasDaLinha, type LinhaComite,
} from "@/lib/domain/comite";
import { confirmar } from "@/lib/cliente/dialogo";
import LendoComIA, { type EtapaLeitura } from "../../LendoComIA";
import { STATUS_COMITE, dataBR } from "../ListaComites";
import { aprovar, excluir, recusar, salvar } from "./actions";

type Cadastro = { id: number; nome: string; cidade: string; regional: string };

const celula = "campo !min-h-[32px] !px-2 !py-1";
const apenasDigitos = (v: string) => (v.replace(/\D/g, "") === "" ? null : Number(v.replace(/\D/g, "")));
const pctTxt = (n: number | null, obs: string) => (n !== null ? String(n).replace(".", ",") : obs);

export default function ConferenciaComite({ comite, cadastro, iaConfigurada }: { comite: Comite; cadastro: Cadastro[]; iaConfigurada: boolean }) {
  const router = useRouter();
  const podeConferir = comite.status === "para_conferir";
  const [linhas, setLinhas] = useState<LinhaComite[]>(comite.linhas);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verPdf, setVerPdf] = useState(false);
  const [lendo, setLendo] = useState<EtapaLeitura | null>(null);
  const [pendente, iniciar] = useTransition();

  // O prazo até a entrega é mostrado a partir do mês em que a vigência começa.
  const referencia = `${comite.vigenciaInicio.slice(0, 7)}-01`;
  const repetidos = useMemo(() => new Set(empreendimentosRepetidos(linhas)), [linhas]);
  const resumo = useMemo(() => {
    const ativas = linhas.filter((l) => !l.ignorar);
    const comPendencia = ativas.filter((l) => problemasDaLinha(l).length > 0 || (l.idEmpreendimento !== null && repetidos.has(l.idEmpreendimento)));
    return { total: linhas.length, ignoradas: linhas.length - ativas.length, pendentes: comPendencia.length, prontas: ativas.length - comPendencia.length };
  }, [linhas, repetidos]);

  const atualizar = (i: number, parcial: Partial<LinhaComite>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...parcial } : l)));
  const desconto = (i: number, qual: "Financiado" | "Avista", valor: string) => {
    const { pct, obs } = lerPercentualOuTexto(valor);
    atualizar(i, qual === "Financiado" ? { descontoFinanciado: pct, descontoFinanciadoObs: obs } : { descontoAvista: pct, descontoAvistaObs: obs });
  };

  function fazerSalvar() {
    setErro(null); setAviso(null);
    iniciar(async () => { await salvar(comite.id, linhas); setAviso("Conferência salva."); router.refresh(); });
  }
  async function fazerAprovar() {
    if (!(await confirmar({
      titulo: "Aprovar e enviar para o Quadro Comparativo?",
      mensagem: `As condições valem de ${dataBR(comite.vigenciaInicio)} a ${dataBR(comite.vigenciaFim)} na coluna da Sousa (desconto, parcelas, prazo e entrega). Um comitê aprovado com a mesma vigência é substituído.`,
      textoConfirmar: "Aprovar",
    }))) return;
    setErro(null); setAviso(null);
    iniciar(async () => {
      const r = await aprovar(comite.id, linhas);
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }
  function fazerRecusar() {
    if (!motivo.trim()) { setErro("Escreva o motivo da recusa (ex.: PDF de outro mês, ilegível)."); return; }
    iniciar(async () => { await recusar(comite.id, motivo); router.push("/gestor/tabelas/comite"); });
  }
  async function fazerExcluir() {
    const ok = await confirmar({
      titulo: "Excluir este comitê?",
      mensagem: comite.status === "aprovado"
        ? "Ele já foi aprovado: o Quadro Comparativo volta a usar os dados da visita do Cliente Oculto. O PDF enviado também é apagado."
        : "O PDF enviado também é apagado.",
      textoConfirmar: "Excluir", perigo: true,
    });
    if (!ok) return;
    iniciar(async () => { await excluir(comite.id); router.push("/gestor/tabelas/comite"); });
  }
  function fazerLerDeNovo() {
    setErro(null); setAviso(null); setLendo("lendo");
    iniciar(async () => {
      const r = await fetch(`/api/comite/${comite.id}/ler`, { method: "POST" }).catch(() => null);
      if (!r || !r.ok) { setErro("Não foi possível ler de novo agora."); setLendo(null); return; }
      setLendo("concluido");
      await new Promise((ok) => setTimeout(ok, 900));
      // Remonta a tela com o resultado novo.
      window.location.reload();
    });
  }

  const st = STATUS_COMITE[comite.status];
  const opcoes = useMemo(() => cadastro.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.cidade}</option>), [cadastro]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/gestor/tabelas/comite" className="text-xs font-semibold text-[var(--brand-text)]">← Comitê de vendas</Link>
          <h1 className="text-2xl font-bold text-ink">Comitê de {dataBR(comite.vigenciaInicio)} a {dataBR(comite.vigenciaFim)}</h1>
          <p className="text-sm text-ink/60">
            {comite.arquivoNome}
            {comite.modeloIa && <> · lido por {comite.modeloIa}</>}
            {comite.enviadoPor && <> · enviado por {comite.enviadoPor}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cor}`}>{st.rotulo}</span>
          <button className="btn-acao" onClick={() => setVerPdf((v) => !v)} aria-expanded={verPdf}>{verPdf ? "Ocultar PDF" : "Ver PDF"}</button>
          <button className="btn-acao btn-acao--perigo" onClick={fazerExcluir} disabled={pendente}>
            <Trash2 size={13} aria-hidden="true" />Excluir comitê
          </button>
        </div>
      </div>

      {comite.status === "aprovado" && (
        <p className="ms-alert ms-alert--info">
          Aprovado{comite.conferidoPor ? ` por ${comite.conferidoPor}` : ""}. Vale no <Link href="/gestor/comparativo" className="font-semibold underline">Quadro Comparativo</Link> das competências que tocam a vigência.
        </p>
      )}
      {comite.status === "recusado" && comite.motivoRecusa && (
        <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]">Recusado: {comite.motivoRecusa}</p>
      )}
      {lendo && <LendoComIA etapa={lendo} />}
      {!lendo && comite.erroIa && podeConferir && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--warning-tint)] px-4 py-3 text-sm text-[var(--warning-ink)]">
          <span className="min-w-0 flex-1">{comite.erroIa}</span>
          {iaConfigurada && linhas.length === 0 && (
            <button className="btn-secundario" onClick={fazerLerDeNovo} disabled={pendente}>
              {pendente ? <><Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />Lendo com IA…</> : "Ler de novo com IA"}
            </button>
          )}
        </div>
      )}
      {comite.observacoesIa && podeConferir && (
        <p className="rounded-lg bg-[var(--surface-2)] px-4 py-3 text-sm text-ink/70"><span className="font-semibold">Observações da IA:</span> {comite.observacoesIa}</p>
      )}
      {verPdf && <iframe title="PDF do comitê" src={`/api/comite/${comite.id}/arquivo`} className="h-[560px] w-full rounded-lg border border-[var(--line)] bg-white" />}

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Produtos lidos", resumo.total, ""], ["Prontos", resumo.prontas, "text-[var(--good-ink)]"],
          ["Com pendência", resumo.pendentes, resumo.pendentes ? "text-[var(--warning-ink)]" : ""], ["Ignorados", resumo.ignoradas, "text-ink/60"]].map(([rotulo, n, cor]) => (
          <div key={String(rotulo)} className="card">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">{rotulo}</div>
            <div className={`mt-1 text-2xl font-bold ${cor || "text-ink"}`}>{n}</div>
          </div>
        ))}
      </div>

      <section className="grid gap-2" aria-label="Produtos do comitê">
        <p className="text-xs text-ink/50">
          O empreendimento do cadastro é sugerido pelo nome: confira antes de aprovar. Pré-chaves = &ldquo;Ato + Parc.&rdquo; · Pós-chaves = Pré-soluto (nº de parcelas) · Desconto = máximo por venda (percentual; se o PDF traz uma exceção em texto, ela fica como está e não entra no Quadro) ·
          Prazo = meses de {dataBR(referencia)} até a entrega.
        </p>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs text-ink/50">
                <th className="px-3 py-3 font-medium">Reg.</th>
                <th className="px-3 py-3 font-medium">Produto no PDF</th>
                <th className="px-3 py-3 font-medium">Empreendimento do cadastro</th>
                <th className="px-3 py-3 font-medium">Entrega</th>
                <th className="px-3 py-3 text-right font-medium">Prazo</th>
                <th className="px-3 py-3 font-medium">Pré-chaves</th>
                <th className="px-3 py-3 font-medium">Pós-chaves</th>
                <th className="px-3 py-3 font-medium">Pré-soluto %</th>
                <th className="px-3 py-3 font-medium">Desc. financ. %</th>
                <th className="px-3 py-3 font-medium">Desc. à vista %</th>
                <th className="px-3 py-3 text-center font-medium">Ignorar</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-ink/50">Nenhuma linha lida. {podeConferir ? "Use \"Incluir linha\" para preencher à mão." : ""}</td></tr>
              )}
              {linhas.map((l, i) => {
                const problemas = [...problemasDaLinha(l), ...(l.idEmpreendimento !== null && !l.ignorar && repetidos.has(l.idEmpreendimento) ? ["Este empreendimento já está em outra linha."] : [])];
                const prazo = prazoAteEntrega(l.previsaoEntrega, referencia);
                return [
                  <tr key={`l${i}`} className={`${problemas.length ? "bg-[var(--warning-tint)]" : ""} ${l.ignorar ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2"><input className={`${celula} w-16 uppercase`} value={l.regional} maxLength={8} disabled={!podeConferir} aria-label={`Regional de ${l.produto}`} onChange={(e) => atualizar(i, { regional: e.target.value.toUpperCase() })} /></td>
                    <td className="px-3 py-2"><input className={`${celula} min-w-[170px]`} value={l.produto} disabled={!podeConferir} aria-label="Produto no PDF" onChange={(e) => atualizar(i, { produto: e.target.value })} /></td>
                    <td className="px-3 py-2">
                      <select className={`${celula} min-w-[200px]`} value={l.idEmpreendimento ?? ""} disabled={!podeConferir} aria-label={`Empreendimento de ${l.produto}`}
                        onChange={(e) => atualizar(i, { idEmpreendimento: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Escolha…</option>
                        {opcoes}
                      </select>
                    </td>
                    <td className="px-3 py-2"><input className={`${celula} w-28`} value={l.previsaoEntrega} placeholder="junho/27" disabled={!podeConferir} aria-label={`Entrega de ${l.produto}`} onChange={(e) => atualizar(i, { previsaoEntrega: e.target.value })} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink/70">{prazo === null ? "—" : prazo === 0 ? "Pronto" : `${prazo} ${prazo === 1 ? "mês" : "meses"}`}</td>
                    <td className="px-3 py-2"><input className={`${celula} w-16`} inputMode="numeric" value={l.parcelasPre ?? ""} disabled={!podeConferir} aria-label={`Parcelas pré-chaves de ${l.produto}`} onChange={(e) => atualizar(i, { parcelasPre: apenasDigitos(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input className={`${celula} w-16`} inputMode="numeric" value={l.parcelasPos ?? ""} disabled={!podeConferir} aria-label={`Parcelas pós-chaves de ${l.produto}`} onChange={(e) => atualizar(i, { parcelasPos: apenasDigitos(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input className={`${celula} w-20`} type="number" min={0} max={100} step="0.01" value={l.posPercentual ?? ""} disabled={!podeConferir} aria-label={`Pré-soluto % de ${l.produto}`} onChange={(e) => atualizar(i, { posPercentual: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                    <td className="px-3 py-2">
                      <input className={`${celula} ${l.descontoFinanciadoObs ? "min-w-[200px]" : "w-20"}`} inputMode="decimal" value={pctTxt(l.descontoFinanciado, l.descontoFinanciadoObs)} disabled={!podeConferir}
                        title={l.descontoFinanciadoObs ? "Exceção em texto no PDF: não entra no Quadro Comparativo" : undefined} aria-label={`Desconto financiado de ${l.produto}`} onChange={(e) => desconto(i, "Financiado", e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={`${celula} ${l.descontoAvistaObs ? "min-w-[200px]" : "w-20"}`} inputMode="decimal" value={pctTxt(l.descontoAvista, l.descontoAvistaObs)} disabled={!podeConferir}
                        title={l.descontoAvistaObs ? "Exceção em texto no PDF" : undefined} aria-label={`Desconto à vista de ${l.produto}`} onChange={(e) => desconto(i, "Avista", e.target.value)} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <input type="checkbox" checked={l.ignorar} disabled={!podeConferir} aria-label={`Ignorar ${l.produto}`} onChange={(e) => atualizar(i, { ignorar: e.target.checked })} />
                        {podeConferir && (
                          <button className="btn-acao btn-acao--perigo !px-2" title="Remover linha" aria-label={`Remover a linha de ${l.produto}`} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  problemas.length > 0 && podeConferir && (
                    <tr key={`p${i}`} className="bg-[var(--warning-tint)]"><td />
                      <td colSpan={10} className="px-3 pb-2 text-xs text-[var(--warning-ink)]">{problemas.join(" ")}</td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {podeConferir && (
          <div>
            <button className="btn-secundario" onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}><Plus size={14} aria-hidden="true" />Incluir linha</button>
          </div>
        )}
      </section>

      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
      {aviso && <p className="rounded-lg bg-[var(--good-tint)] px-4 py-3 text-sm text-[var(--good-ink)]" role="status">{aviso}</p>}

      {podeConferir && (
        <div className="card grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary btn-cabecalho" onClick={fazerAprovar} disabled={pendente || resumo.pendentes > 0 || resumo.prontas === 0}
              title={resumo.pendentes > 0 ? "Resolva as pendências (ou ignore as linhas) antes de aprovar" : undefined}>
              {pendente ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : null}Aprovar
            </button>
            <button className="btn-secundario btn-cabecalho" onClick={fazerSalvar} disabled={pendente}>Salvar conferência</button>
            {resumo.pendentes > 0 && <span className="text-xs text-[var(--warning-ink)]">{resumo.pendentes} linha(s) com pendência.</span>}
          </div>
          <div className="grid gap-2 border-t border-dashed border-[var(--line)] pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label className="rotulo" htmlFor="comite-motivo">Recusar este comitê (motivo)</label>
              <input id="comite-motivo" className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: PDF de outro mês, ilegível" />
            </div>
            <button className="btn-secundario btn-acao--perigo" onClick={fazerRecusar} disabled={pendente}>Recusar</button>
          </div>
        </div>
      )}
    </div>
  );
}
