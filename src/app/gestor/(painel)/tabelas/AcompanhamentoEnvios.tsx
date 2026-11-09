"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import CampoData from "@/components/CampoData";
import { confirmar } from "@/lib/cliente/dialogo";
import { filtrarEnvios, resumirEnvios, type FiltroEnvio, type LinhaEnvio, type StatusEnvio } from "@/lib/domain/acompanhamento";
import { excluir } from "./[id]/actions";

const STATUS: Record<StatusEnvio, { rotulo: string; fundo: string; selo: string }> = {
  aprovado: { rotulo: "Aprovado", fundo: "bg-[var(--good-tint)]", selo: "text-[var(--good-ink)] border-[var(--good-ink)]/30" },
  pendente: { rotulo: "Pendente", fundo: "bg-[var(--warning-tint)]", selo: "text-[var(--warning-ink)] border-[var(--warning-ink)]/30" },
};

const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const unicos = <T,>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);

/** `children` (o formulário de envio) fica entre os indicadores e os filtros/lista. */
export default function AcompanhamentoEnvios({ linhas, mes, podeExcluir = false, podeConferir = false, children }: {
  linhas: LinhaEnvio[]; mes: string; podeExcluir?: boolean; podeConferir?: boolean; children?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function fazerExcluir(l: LinhaEnvio) {
    if (!l.idLeitura) return;
    const ok = await confirmar({
      titulo: `Excluir a leitura de ${l.concorrente}?`,
      mensagem: l.status === "aprovado"
        ? "Ela já foi aprovada: a coleta deste mês na Pesquisa e os preços do mês saem junto. O arquivo enviado também é apagado."
        : "O arquivo enviado também é apagado.",
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluir(l.idLeitura!);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  }
  const [f, setF] = useState<FiltroEnvio>({ status: "", regional: "", idCidade: "", idEmpreendimento: "" });

  // Os filtros de cima restringem os de baixo: Regional, Cidade e Empreendimento.
  const regionais = useMemo(() => unicos(linhas.map((l) => l.regional)), [linhas]);
  const cidades = useMemo(() => {
    const m = new Map<number, string>();
    linhas.filter((l) => !f.regional || l.regional === f.regional).forEach((l) => m.set(l.idCidade, l.cidade));
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhas, f.regional]);
  const emps = useMemo(() => {
    const m = new Map<number, string>();
    filtrarEnvios(linhas, { regional: f.regional, idCidade: f.idCidade }, false).forEach((l) => m.set(l.idEmpreendimento, l.empreendimento));
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhas, f.regional, f.idCidade]);

  // Indicadores acompanham regional/cidade/empreendimento, mas contam todos os status.
  const resumo = resumirEnvios(filtrarEnvios(linhas, f, false));
  const visiveis = filtrarEnvios(linhas, f);
  const pct = resumo.total ? Math.round((resumo.enviados / resumo.total) * 100) : 0;
  const temFiltro = f.status || f.regional || f.idCidade || f.idEmpreendimento;

  function trocarMes(v: string) {
    const p = new URLSearchParams(params.toString());
    if (v) p.set("mes", v); else p.delete("mes");
    router.push(`/gestor/tabelas?${p.toString()}`);
  }

  const indicador = (rotulo: string, valor: number, status: "" | StatusEnvio, cor?: string) => (
    <button type="button" aria-pressed={f.status === status}
      onClick={() => setF({ ...f, status })}
      className={`card text-left transition ${f.status === status ? "ring-2 ring-[var(--brand)]" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">{rotulo}</div>
      <div className={`mt-1 text-2xl font-bold ${cor ?? "text-ink"}`}>{valor}</div>
    </button>
  );

  return (
    <section className="grid gap-3" aria-label="Acompanhamento de envios">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Acompanhamento de envios</h2>
          <p className="text-sm text-ink/50">Concorrentes ativos: aprovado quando a leitura do mês foi conferida; pendente nos demais casos.</p>
        </div>
        <div className="w-44">
          <label className="rotulo">Competência</label>
          <CampoData tipo="mes" value={mes.slice(0, 7)} onChange={trocarMes} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {indicador("Total de concorrentes", resumo.total, "")}
        {indicador("Total enviados", resumo.enviados, "aprovado", "text-[var(--good-ink)]")}
        {indicador("Total pendentes", resumo.pendentes, "pendente", "text-[var(--warning-ink)]")}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--warning-tint)]" role="img" aria-label={`${pct}% enviados`}>
        <div className="h-full bg-[var(--good-ink)]" style={{ width: `${pct}%` }} />
      </div>

      {children && <div className="my-3">{children}</div>}

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="rotulo" htmlFor="ae-status">Status</label>
          <select id="ae-status" className="campo" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as FiltroEnvio["status"] })}>
            <option value="">Todos</option>
            <option value="aprovado">Aprovado</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="ae-regional">Regional</label>
          <select id="ae-regional" className="campo" value={f.regional} onChange={(e) => setF({ ...f, regional: e.target.value, idCidade: "", idEmpreendimento: "" })}>
            <option value="">Todas</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="ae-cidade">Cidade</label>
          <select id="ae-cidade" className="campo" value={f.idCidade} onChange={(e) => setF({ ...f, idCidade: e.target.value, idEmpreendimento: "" })}>
            <option value="">Todas</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="ae-emp">Empreendimento</label>
          <select id="ae-emp" className="campo" value={f.idEmpreendimento} onChange={(e) => setF({ ...f, idEmpreendimento: e.target.value })}>
            <option value="">Todos</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        {temFiltro && (
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="button" className="btn-ghost" onClick={() => setF({ status: "", regional: "", idCidade: "", idEmpreendimento: "" })}>Limpar filtros</button>
          </div>
        )}
      </div>

      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Concorrente</th>
              <th className="px-4 py-3 font-medium">Regional</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 text-right font-medium">Estoque</th>
              <th className="px-4 py-3 text-right font-medium">Vendas</th>
              <th className="px-4 py-3 font-medium">Enviado</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">Nenhum concorrente com esses filtros.</td></tr>
            )}
            {visiveis.map((l) => (
              <tr key={l.idConcorrente} className={`border-b border-[var(--line)] ${STATUS[l.status].fundo}`}>
                <td className="px-4 py-3"><span className="font-medium text-ink">{l.concorrente}</span><span className="block text-xs text-ink/50">{l.empreendimento}</span></td>
                <td className="px-4 py-3">{l.regional}</td>
                <td className="px-4 py-3">{l.cidade}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.estoque ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.vendas ?? "—"}</td>
                <td className="px-4 py-3 text-ink/70">
                  {l.enviadoEm ? dataBR(l.enviadoEm) : "—"}
                  {l.enviadoPor && <span className="block text-xs text-ink/50">{l.enviadoPor}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[l.status].selo}`}>{STATUS[l.status].rotulo}</span>
                  {l.detalhe && <span className="mt-1 block text-xs text-[var(--warning-ink)]">{l.detalhe}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {l.idLeitura ? (
                    <div className="acoes-linha justify-end">
                      <a className="btn-acao" href={`/gestor/tabelas/${l.idLeitura}`}>{l.paraConferir && podeConferir ? "Conferir" : "Abrir"}</a>
                      {podeExcluir && (
                        <button className="btn-acao btn-acao--perigo !px-2" title="Excluir leitura" aria-label={`Excluir leitura de ${l.concorrente}`}
                          disabled={pendente} onClick={() => fazerExcluir(l)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ) : <span className="text-ink/40">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
