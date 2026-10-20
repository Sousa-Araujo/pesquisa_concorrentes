"use client";

/**
 * Conferência da leitura: o documento de um lado e, do outro, os números
 * calculados e a lista de unidades lida pela IA, que dá para corrigir
 * (status, valor, incluir e excluir). Sem leitura da IA, os números são
 * digitados direto. Aprovar grava na Pesquisa; recusar guarda o motivo.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Leitura } from "@/lib/data/tabelas";
import { resumirUnidades, type Unidade } from "@/lib/domain/tabelas";
import { STATUS_LEITURA } from "../ListaLeituras";
import LendoComIA, { type EtapaLeitura } from "../LendoComIA";
import ResumoUnidades from "./ResumoUnidades";
import EditarUnidade from "./EditarUnidade";
import { aprovar, excluir, lerDeNovo, recusar, salvar } from "./actions";

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const paraCentavos = (txt: string) => { const d = txt.replace(/\D/g, ""); return d ? Number(d) * 100 : null; };
const mesBR = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

export default function ConferenciaLeitura({ leitura, podeConferir, iaConfigurada, podeExcluir }: {
  leitura: Leitura; podeConferir: boolean; iaConfigurada: boolean; podeExcluir: boolean;
}) {
  const router = useRouter();
  const [unidades, setUnidades] = useState<Unidade[]>(leitura.unidades);
  const [vendasManual, setVendasManual] = useState<string>(leitura.resumo.vendasMetodo === null && leitura.resumo.vendasMes !== null ? String(leitura.resumo.vendasMes) : "");
  const semUnidades = unidades.length === 0;
  const [numeros, setNumeros] = useState({
    estoque: String(semUnidades ? leitura.resumo.estoque || "" : ""), reservadas: String(semUnidades ? leitura.resumo.reservadas || "" : ""),
    valorMin: leitura.resumo.valorMin ? String(leitura.resumo.valorMin / 100) : "", valorMax: leitura.resumo.valorMax ? String(leitura.resumo.valorMax / 100) : "",
    ticket: leitura.resumo.ticketMedio ? String(Math.round(leitura.resumo.ticketMedio / 100)) : "",
    descontoMin: leitura.resumo.descontoMin ? String(leitura.resumo.descontoMin / 100) : "", descontoMax: leitura.resumo.descontoMax ? String(leitura.resumo.descontoMax / 100) : "",
    ticketDesconto: leitura.resumo.ticketDesconto ? String(Math.round(leitura.resumo.ticketDesconto / 100)) : "",
  });
  const [edicao, setEdicao] = useState<"editar" | "incluir" | null>(null);
  const [editadas, setEditadas] = useState<Set<number>>(new Set());
  const [excluidas, setExcluidas] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [lendo, setLendo] = useState<EtapaLeitura | null>(null);

  // Recalcula na hora (as vendas usam a referência que veio do servidor).
  const resumo = useMemo(() => {
    if (semUnidades) {
      // Sem a lista: os cartões mostram o que foi digitado.
      const vendas = vendasManual !== "" ? Number(vendasManual) : leitura.resumo.vendasMes;
      return {
        ...leitura.resumo,
        valorMin: paraCentavos(numeros.valorMin), valorMax: paraCentavos(numeros.valorMax), ticketMedio: paraCentavos(numeros.ticket),
        descontoMin: paraCentavos(numeros.descontoMin), descontoMax: paraCentavos(numeros.descontoMax), ticketDesconto: paraCentavos(numeros.ticketDesconto),
        unidadeMin: null, unidadeMax: null,
        vendasMes: vendas, vendasMetodo: vendasManual !== "" ? null : leitura.resumo.vendasMetodo,
      };
    }
    const r = resumirUnidades(unidades, null, null);
    return { ...r, vendasMes: vendasManual !== "" ? Number(vendasManual) : leitura.resumo.vendasMes, vendasMetodo: vendasManual !== "" ? null : leitura.resumo.vendasMetodo };
  }, [unidades, vendasManual, semUnidades, numeros, leitura.resumo]);

  const conferencia = () => ({
    unidades,
    vendasMes: vendasManual !== "" ? Number(vendasManual) : null,
    numeros: semUnidades ? {
      estoque: Number(numeros.estoque || 0), reservadas: Number(numeros.reservadas || 0),
      vendasMes: vendasManual !== "" ? Number(vendasManual) : null,
      valorMin: paraCentavos(numeros.valorMin), valorMax: paraCentavos(numeros.valorMax), ticketMedio: paraCentavos(numeros.ticket),
      descontoMin: paraCentavos(numeros.descontoMin), descontoMax: paraCentavos(numeros.descontoMax), ticketDesconto: paraCentavos(numeros.ticketDesconto),
    } : null,
  });

  function fazerSalvar() {
    setErro(null); setAviso(null);
    iniciar(async () => { await salvar(leitura.id, conferencia()); setAviso("Conferência salva."); router.refresh(); });
  }
  function fazerAprovar() {
    if (!confirm("Aprovar? Estoque e vendas entram na Pesquisa deste mês (substituindo a coleta do agente, se houver) e os preços vão para o comparativo.")) return;
    setErro(null); setAviso(null);
    iniciar(async () => {
      const r = await aprovar(leitura.id, conferencia());
      if (!r.ok) setErro(r.erro); else router.push("/gestor/tabelas/conferir");
    });
  }
  function fazerLerDeNovo() {
    setErro(null); setAviso(null);
    setLendo("lendo");
    iniciar(async () => {
      const r = await lerDeNovo(leitura.id);
      if (!r.ok) { setErro(r.erro); setLendo(null); return; }
      setLendo("concluido");
      await new Promise((ok) => setTimeout(ok, 900));
      // Remonta a tela com o resultado novo (lista de unidades e cartões).
      window.location.reload();
    });
  }
  function fazerExcluir() {
    const msg = leitura.status === "aprovada"
      ? "Excluir esta leitura? Ela já foi aprovada: a coleta deste mês na Pesquisa e os preços do mês saem junto."
      : "Excluir esta leitura? O arquivo enviado também é apagado.";
    if (!confirm(msg)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluir(leitura.id);
      if (!r.ok) setErro(r.erro); else router.push("/gestor/tabelas");
    });
  }
  function fazerRecusar() {
    if (!motivo.trim()) { setErro("Escreva o motivo da recusa (ex.: documento de outro empreendimento, ilegível)."); return; }
    iniciar(async () => { await recusar(leitura.id, motivo); router.push(podeConferir ? "/gestor/tabelas/conferir" : "/gestor/tabelas"); });
  }

  const r = resumo ?? leitura.resumo;
  // Só mostra os campos "com desconto" quando algum valor com desconto existe (ou dá para digitar).
  const temDesconto = r.ticketDesconto !== null || unidades.some((u) => u.valorDescontoCentavos != null);
  const st = STATUS_LEITURA[leitura.status];
  const ehPdf = leitura.arquivoMime === "application/pdf";
  const urlArquivo = `/api/tabelas/${leitura.id}/arquivo`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/gestor/tabelas" className="text-xs font-semibold text-[var(--brand-text)]">← Tabelas e espelhos</Link>
          <h1 className="text-2xl font-bold text-ink">{leitura.concorrente}</h1>
          <p className="text-sm text-ink/60">{leitura.empreendimento} · {leitura.regional} · referência {mesBR(leitura.mesAno)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cor}`}>{st.rotulo}</span>
          {podeExcluir && (
            <button className="btn-acao btn-acao--perigo" onClick={fazerExcluir} disabled={pendente}>
              <Trash2 size={13} aria-hidden="true" />Excluir leitura
            </button>
          )}
        </div>
      </div>
      {erro && !podeConferir && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}

      {lendo && <LendoComIA etapa={lendo} />}
      {!lendo && leitura.erroIa && leitura.status === "para_conferir" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--warning-tint)] px-4 py-3 text-sm text-[var(--warning-ink)]">
          <span className="min-w-0 flex-1">{leitura.erroIa}</span>
          {iaConfigurada && unidades.length === 0 && (
            <button className="btn-secundario" onClick={fazerLerDeNovo} disabled={pendente}>{pendente ? <><Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />Lendo com IA…</> : "Ler de novo com IA"}</button>
          )}
        </div>
      )}
      {leitura.status === "recusada" && leitura.motivoRecusa && (
        <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]">Recusada: {leitura.motivoRecusa}</p>
      )}
      {leitura.coletaSubstituida && (
        <p className="text-xs text-ink/60">Substituiu a coleta de campo de {leitura.coletaSubstituida.agente ?? "agente"}: estoque {leitura.coletaSubstituida.estoque}, vendas {leitura.coletaSubstituida.vendas}.</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* self-start: o cartão do documento não estica até a altura da coluna da direita. */}
        <div className="card self-start p-0 xl:sticky xl:top-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2 text-sm">
            <span className="truncate text-ink/70">{leitura.arquivoNome}</span>
            <a className="btn-acao" href={urlArquivo} target="_blank" rel="noopener">Abrir em outra aba</a>
          </div>
          {ehPdf
            ? <iframe src={urlArquivo} title="Documento enviado" className="h-[70vh] w-full rounded-b-[var(--radius-card)]" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={urlArquivo} alt="Documento enviado" className="max-h-[70vh] w-full object-contain" />}
        </div>

        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              semUnidades
                ? ["Estoque", numeros.estoque ? `${numeros.estoque} UHs` : "—", `${numeros.reservadas || 0} reservadas`]
                : ["Estoque", `${r.estoque} UHs`, `${r.disponiveis} disponíveis + ${r.reservadas} reservadas`],
              ["Vendas do mês", `${r.vendasMes ?? 0} UHs`,
                r.vendasMetodo === "unidades" ? "comparado com a leitura anterior" : r.vendasMetodo === "estoque" ? "pelo estoque do mês anterior" : r.vendasMes !== null ? "informado na conferência" : "sem mês anterior para comparar"],
              ["Vendidas (total)", semUnidades ? null : `${r.vendidasTotal} de ${r.totalUnidades}`, ""],
              ["Maior valor", brl(r.valorMax), [temDesconto ? "de tabela" : "", r.unidadeMax].filter(Boolean).join(" · ")],
              ["Menor valor", brl(r.valorMin), [temDesconto ? "de tabela" : "", r.unidadeMin].filter(Boolean).join(" · ")],
              ["Ticket médio", brl(r.ticketMedio), temDesconto ? "de tabela, das disponíveis" : "das disponíveis"],
              ["Maior c/ desconto", temDesconto ? brl(r.descontoMax) : null, ""],
              ["Menor c/ desconto", temDesconto ? brl(r.descontoMin) : null, ""],
              ["Ticket c/ desconto", temDesconto ? brl(r.ticketDesconto) : null, "das disponíveis"],
            ].filter(([, v]) => v !== null).map(([rot, v, sub]) => (
              <div key={rot} className="card !p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{rot}</div>
                <div className="text-lg font-bold tabular-nums text-ink">{v}</div>
                {sub && <div className="text-xs text-ink/50">{sub}</div>}
              </div>
            ))}
          </div>

          {podeConferir && (
            <div className="card grid gap-3">
              {semUnidades && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <p className="text-sm text-ink/60 sm:col-span-3">Sem a lista de unidades: digite os números conferidos no documento.</p>
                  <div><label className="rotulo">Estoque (disp. + reserv.)</label><input className="campo" inputMode="numeric" value={numeros.estoque} onChange={(e) => setNumeros({ ...numeros, estoque: e.target.value.replace(/\D/g, "") })} /></div>
                  <div><label className="rotulo">Reservadas</label><input className="campo" inputMode="numeric" value={numeros.reservadas} onChange={(e) => setNumeros({ ...numeros, reservadas: e.target.value.replace(/\D/g, "") })} /></div>
                  <div><label className="rotulo">Ticket médio (R$)</label><input className="campo" inputMode="numeric" value={numeros.ticket} onChange={(e) => setNumeros({ ...numeros, ticket: e.target.value })} /></div>
                  <div><label className="rotulo">Maior valor (R$)</label><input className="campo" inputMode="numeric" value={numeros.valorMax} onChange={(e) => setNumeros({ ...numeros, valorMax: e.target.value })} /></div>
                  <div><label className="rotulo">Menor valor (R$)</label><input className="campo" inputMode="numeric" value={numeros.valorMin} onChange={(e) => setNumeros({ ...numeros, valorMin: e.target.value })} /></div>
                  <p className="text-xs text-ink/50 sm:col-span-3">Se a tabela tiver valor com desconto (opcional):</p>
                  <div><label className="rotulo">Ticket c/ desconto (R$)</label><input className="campo" inputMode="numeric" value={numeros.ticketDesconto} onChange={(e) => setNumeros({ ...numeros, ticketDesconto: e.target.value })} /></div>
                  <div><label className="rotulo">Maior c/ desconto (R$)</label><input className="campo" inputMode="numeric" value={numeros.descontoMax} onChange={(e) => setNumeros({ ...numeros, descontoMax: e.target.value })} /></div>
                  <div><label className="rotulo">Menor c/ desconto (R$)</label><input className="campo" inputMode="numeric" value={numeros.descontoMin} onChange={(e) => setNumeros({ ...numeros, descontoMin: e.target.value })} /></div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <label className="rotulo">Vendas do mês (deixe vazio para usar o cálculo)</label>
                  <input className="campo" inputMode="numeric" value={vendasManual} placeholder={r.vendasMes !== null && vendasManual === "" ? String(r.vendasMes) : ""} onChange={(e) => setVendasManual(e.target.value.replace(/\D/g, ""))} />
                </div>
                <button className="btn-secundario" onClick={fazerSalvar} disabled={pendente}>Salvar conferência</button>
              </div>
              <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3">
                <button className="btn-primary btn-cabecalho" onClick={fazerAprovar} disabled={pendente}>Aprovar e enviar para a Pesquisa</button>
                <div className="flex min-w-[220px] flex-1 gap-2">
                  <input className="campo" placeholder="Motivo da recusa" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <button className="btn-acao btn-acao--perigo" onClick={fazerRecusar} disabled={pendente}>Recusar</button>
                </div>
              </div>
              {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
              {aviso && <p className="text-sm text-[var(--good-ink)]">{aviso}</p>}
            </div>
          )}

          {leitura.observacoesIa && <p className="text-sm text-ink/60"><b>Observações da IA:</b> {leitura.observacoesIa}</p>}

          {(!semUnidades || podeConferir) && (
            <div className="card grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Resumo da tabela ({unidades.length} unidades)</span>
                {podeConferir && (
                  <div className="flex flex-wrap gap-2">
                    {!semUnidades && (
                      <button className="btn-acao" onClick={() => setEdicao("editar")}><Pencil size={13} aria-hidden="true" />Editar unidade</button>
                    )}
                    <button className="btn-acao" onClick={() => setEdicao("incluir")}><Plus size={13} aria-hidden="true" />Incluir unidade</button>
                  </div>
                )}
              </div>
              {editadas.size > 0 && (
                <p className="rounded-lg bg-[var(--warning-tint)] px-3 py-2 text-sm text-[var(--warning-ink)]">
                  {editadas.size} {editadas.size === 1 ? "unidade alterada" : "unidades alteradas"}{excluidas > 0 ? ` e ${excluidas} excluída${excluidas > 1 ? "s" : ""}` : ""}. Clique em Salvar conferência ou Aprovar para gravar.
                </p>
              )}
              {semUnidades
                ? <p className="text-sm text-ink/50">A IA não trouxe a lista de unidades.</p>
                : <ResumoUnidades unidades={unidades} editadas={editadas} temDesconto={temDesconto} />}
            </div>
          )}
          {edicao && (
            <EditarUnidade unidades={unidades} novo={edicao === "incluir"} onFechar={() => setEdicao(null)}
              onAplicar={(i, u) => {
                if (i === null) { setUnidades((us) => [...us, u]); setEditadas((e) => new Set(e).add(unidades.length)); }
                else { setUnidades((us) => us.map((x, j) => (j === i ? u : x))); setEditadas((e) => new Set(e).add(i)); }
                setEdicao(null);
              }}
              onExcluir={(i) => {
                setUnidades((us) => us.filter((_, j) => j !== i));
                // Reindexa as marcações depois da exclusão.
                setEditadas((e) => new Set([...e].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
                setExcluidas((n) => n + 1);
                setEdicao(null);
              }} />
          )}
            </div>
      </div>
    </div>
  );
}
