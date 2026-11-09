"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Save, Upload } from "lucide-react";
import CampoData from "@/components/CampoData";
import LendoComIA, { type EtapaLeitura } from "./LendoComIA";
import { actCidades, actConcorrentes, actEmpreendimentos } from "@/app/agente/actions";

type Item = { id: number; nome: string };

export default function EnvioTabela({ regionais, mesInicial, podeConferir }: { regionais: string[]; mesInicial: string; podeConferir: boolean }) {
  const router = useRouter();
  const [regional, setRegional] = useState("");
  const [idCidade, setIdCidade] = useState("");
  const [idEmp, setIdEmp] = useState("");
  const [idConc, setIdConc] = useState("");
  const [cidades, setCidades] = useState<Item[]>([]);
  const [emps, setEmps] = useState<Item[]>([]);
  const [concs, setConcs] = useState<Item[]>([]);
  const [mes, setMes] = useState(mesInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<EtapaLeitura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Envio manual: estoque e vendas digitados, sem arquivo.
  const [manual, setManual] = useState(false);
  const [estoque, setEstoque] = useState("");
  const [vendas, setVendas] = useState("");
  const [salvandoManual, setSalvandoManual] = useState(false);
  const enviando = etapa !== null || salvandoManual;
  const podeManual = Boolean(idConc && mes);

  useEffect(() => { if (regional) actCidades(regional).then((cs) => setCidades(cs.map((c) => ({ id: c.id_cidade, nome: c.cidade })))); else setCidades([]); }, [regional]);
  useEffect(() => { if (idCidade) actEmpreendimentos(Number(idCidade)).then((es) => setEmps(es.map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento })))); else setEmps([]); }, [idCidade]);
  useEffect(() => { if (idEmp) actConcorrentes(Number(idEmp)).then((cs) => setConcs(cs.map((c) => ({ id: c.id_concorrente, nome: c.concorrente })))); else setConcs([]); }, [idEmp]);

  async function enviar() {
    setErro(null);
    if (!idConc) { setErro("Escolha o concorrente."); return; }
    if (!arquivo) { setErro("Escolha o arquivo (PDF ou imagem)."); return; }
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    dados.set("idConcorrente", idConc);
    dados.set("mes", mes);
    setEtapa("recebido");
    try {
      const r = await fetch("/api/tabelas", { method: "POST", body: dados });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar."); setEtapa(null); return; }
      setEtapa("lendo");
      // Se a leitura falhar, o arquivo já está guardado: a conferência mostra o aviso e o "Ler de novo".
      await fetch(`/api/tabelas/${j.id}/ler`, { method: "POST" }).catch(() => null);
      setEtapa("concluido");
      await new Promise((ok) => setTimeout(ok, 900));
      if (podeConferir) router.push(`/gestor/tabelas/${j.id}`);
      else { setArquivo(null); setEtapa(null); router.refresh(); }
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      setEtapa(null);
    }
  }

  async function salvarManual() {
    setErro(null);
    if (!idConc) { setErro("Escolha o concorrente."); return; }
    if (estoque === "") { setErro("Informe a quantidade em estoque."); return; }
    if (vendas === "") { setErro("Informe as vendas realizadas no período."); return; }
    const dados = new FormData();
    dados.set("manual", "1");
    dados.set("idConcorrente", idConc);
    dados.set("mes", mes);
    dados.set("estoque", estoque);
    dados.set("vendas", vendas);
    setSalvandoManual(true);
    try {
      const r = await fetch("/api/tabelas", { method: "POST", body: dados });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível salvar."); return; }
      if (podeConferir) { router.push(`/gestor/tabelas/${j.id}`); return; }
      setEstoque(""); setVendas(""); setManual(false);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setSalvandoManual(false);
    }
  }

  return (
    <div className="card grid gap-4">
      <h2 className="text-base font-bold text-ink">Enviar tabela ou espelho</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="rotulo">Regional</label>
          <select className="campo" value={regional} onChange={(e) => { setRegional(e.target.value); setIdCidade(""); setIdEmp(""); setIdConc(""); }}>
            <option value="">Selecione…</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Cidade</label>
          <select className="campo" value={idCidade} disabled={!regional} onChange={(e) => { setIdCidade(e.target.value); setIdEmp(""); setIdConc(""); }}>
            <option value="">Selecione…</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Empreendimento Sousa</label>
          <select className="campo" value={idEmp} disabled={!idCidade} onChange={(e) => { setIdEmp(e.target.value); setIdConc(""); }}>
            <option value="">Selecione…</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Concorrente</label>
          <select className="campo" value={idConc} disabled={!idEmp} onChange={(e) => setIdConc(e.target.value)}>
            <option value="">Selecione…</option>
            {concs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
        <div>
          <label className="rotulo">Mês de referência</label>
          <CampoData tipo="mes" value={mes} onChange={(v) => v && setMes(v)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="tab-arquivo">Arquivo (PDF ou imagem, até 10 MB)</label>
          <input id="tab-arquivo" className="campo" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-cabecalho" onClick={enviar} disabled={enviando}>
            {etapa ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}{etapa ? "Enviando…" : "Enviar e ler"}
          </button>
          <button className="btn-secundario btn-cabecalho" onClick={() => { setManual((m) => !m); setErro(null); }}
            disabled={!podeManual || enviando} aria-expanded={manual}
            title={podeManual ? "Informar estoque e vendas sem arquivo" : "Escolha o concorrente e o mês primeiro"}>
            <PencilLine size={14} aria-hidden="true" />Enviar manualmente
          </button>
        </div>
      </div>
      {manual && podeManual && (
        <div className="grid gap-3 border-t border-dashed border-[var(--line)] pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="rotulo" htmlFor="tab-estoque">Quantidade (estoque)</label>
            <input id="tab-estoque" className="campo" inputMode="numeric" pattern="[0-9]*" placeholder="Ex.: 42"
              value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="tab-vendas">Vendas realizadas no período</label>
            <input id="tab-vendas" className="campo" inputMode="numeric" pattern="[0-9]*" placeholder="Ex.: 5"
              value={vendas} onChange={(e) => setVendas(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button className="btn-primary btn-cabecalho" onClick={salvarManual} disabled={enviando}>
            {salvandoManual ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}{salvandoManual ? "Salvando…" : "Salvar dados"}
          </button>
          <p className="text-xs text-ink/50 sm:col-span-3">Os números vão para a conferência do Coordenador de Market Share, como as tabelas lidas pela IA.</p>
        </div>
      )}
      {etapa && <LendoComIA etapa={etapa} />}
      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
    </div>
  );
}
