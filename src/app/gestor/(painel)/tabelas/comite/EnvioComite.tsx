"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import CampoData from "@/components/CampoData";
import LendoComIA, { type EtapaLeitura } from "../LendoComIA";

export default function EnvioComite() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [etapa, setEtapa] = useState<EtapaLeitura | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    if (!arquivo) { setErro("Escolha o PDF do comitê."); return; }
    if (!inicio || !fim) { setErro("Informe a vigência (início e fim) das condições deste comitê."); return; }
    if (inicio > fim) { setErro("O início da vigência não pode ser depois do fim."); return; }
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    dados.set("vigenciaInicio", inicio);
    dados.set("vigenciaFim", fim);
    setEtapa("recebido");
    try {
      const r = await fetch("/api/comite", { method: "POST", body: dados });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar."); setEtapa(null); return; }
      setEtapa("lendo");
      // Se a leitura falhar, o PDF já está guardado: a conferência mostra o aviso e o "Ler de novo".
      await fetch(`/api/comite/${j.id}/ler`, { method: "POST" }).catch(() => null);
      setEtapa("concluido");
      await new Promise((ok) => setTimeout(ok, 900));
      router.push(`/gestor/tabelas/comite/${j.id}`);
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      setEtapa(null);
    }
  }

  return (
    <div className="card grid gap-4">
      <h2 className="text-base font-bold text-ink">Enviar comitê</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="comite-arquivo">PDF do comitê (até 10 MB)</label>
          <input id="comite-arquivo" className="campo" type="file" accept="application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="comite-inicio">Vigência: início</label>
          <CampoData id="comite-inicio" tipo="data" value={inicio} onChange={setInicio} />
        </div>
        <div>
          <label className="rotulo" htmlFor="comite-fim">Vigência: fim</label>
          <CampoData id="comite-fim" tipo="data" value={fim} onChange={setFim} />
        </div>
        <button className="btn-primary btn-cabecalho" onClick={enviar} disabled={etapa !== null}>
          {etapa ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}{etapa ? "Enviando…" : "Enviar e ler"}
        </button>
      </div>
      <p className="text-xs text-ink/50">
        A vigência está no rodapé do PDF (&ldquo;válidas para as vendas realizadas entre…&rdquo;) e é informada aqui, não lida pela IA. Um novo comitê com a mesma vigência substitui o anterior.
      </p>
      {etapa && <LendoComIA etapa={etapa} />}
      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
    </div>
  );
}
