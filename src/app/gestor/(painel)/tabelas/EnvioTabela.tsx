"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import CampoData from "@/components/CampoData";
import LendoComIA from "./LendoComIA";
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
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    setEnviando(true);
    try {
      const r = await fetch("/api/tabelas", { method: "POST", body: dados });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar."); return; }
      if (podeConferir) router.push(`/gestor/tabelas/${j.id}`);
      else { setArquivo(null); router.refresh(); }
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setEnviando(false);
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
        <button className="btn-primary btn-cabecalho" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}{enviando ? "Lendo com IA…" : "Enviar e ler"}
        </button>
      </div>
      {enviando && <LendoComIA />}
      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
    </div>
  );
}
