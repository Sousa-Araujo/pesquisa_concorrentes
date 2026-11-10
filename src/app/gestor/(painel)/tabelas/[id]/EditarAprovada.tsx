"use client";

/**
 * Correção, pelo administrador, de uma leitura já aprovada: data de
 * referência (mês), estoque e vendas. Vale na Pesquisa e no Comparativo; a
 * lista de unidades e os preços do documento não mudam. Cada correção fica
 * registrada (quem, quando, antes e depois).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import CampoData from "@/components/CampoData";
import type { Leitura } from "@/lib/data/tabelas";
import { confirmar } from "@/lib/cliente/dialogo";
import { editarAprovada } from "./actions";

const mesBR = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const soDigitos = (v: string) => v.replace(/\D/g, "");

export default function EditarAprovada({ leitura }: { leitura: Leitura }) {
  const router = useRouter();
  const mesOriginal = leitura.mesAno.slice(0, 7);
  const [mes, setMes] = useState(mesOriginal);
  const [estoque, setEstoque] = useState(String(leitura.resumo.estoque));
  const [vendas, setVendas] = useState(String(leitura.resumo.vendasMes ?? 0));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const alterou = mes !== mesOriginal || estoque !== String(leitura.resumo.estoque) || vendas !== String(leitura.resumo.vendasMes ?? 0);

  async function salvar() {
    setErro(null); setAviso(null);
    const mudouMes = mes !== mesOriginal;
    const ok = await confirmar({
      titulo: "Salvar a correção?",
      mensagem: mudouMes
        ? `A coleta e os preços de ${leitura.concorrente} passam de ${mesBR(mesOriginal)} para ${mesBR(mes)}. Em ${mesBR(mesOriginal)} o concorrente fica sem esse dado na Pesquisa. O Comparativo usa os novos valores.`
        : `Estoque e vendas de ${leitura.concorrente} em ${mesBR(mesOriginal)} passam a valer na Pesquisa e no Comparativo.`,
      textoConfirmar: "Salvar",
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await editarAprovada(leitura.id, { mes, estoque, vendas });
      if (!r.ok) { setErro(r.erro); return; }
      setAviso("Correção salva.");
      router.refresh();
    });
  }

  return (
    <div className="card grid gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Corrigir dados aprovados (administrador)</h2>
        <p className="text-xs text-ink/50">
          Muda a data de referência, o estoque e as vendas que a Pesquisa e o Comparativo usam. A lista de unidades e os preços do documento não mudam.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="ea-mes">Data de referência</label>
          <CampoData tipo="mes" id="ea-mes" value={mes} onChange={(v) => v && setMes(v)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ea-estoque">Estoque</label>
          <input id="ea-estoque" className="campo" inputMode="numeric" value={estoque} onChange={(e) => setEstoque(soDigitos(e.target.value))} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ea-vendas">Vendas</label>
          <input id="ea-vendas" className="campo" inputMode="numeric" value={vendas} onChange={(e) => setVendas(soDigitos(e.target.value))} />
        </div>
        <button className="btn-primary btn-cabecalho" onClick={salvar} disabled={pendente || !alterou || estoque === "" || vendas === ""}>
          {pendente ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : null}Salvar correção
        </button>
      </div>
      {erro && <p className="rounded-lg bg-[var(--critical-tint)] px-4 py-3 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}
      {aviso && <p className="text-sm text-[var(--good-ink)]" role="status">{aviso}</p>}
      {leitura.edicoesAdmin.length > 0 && (
        <ul className="grid gap-1 border-t border-[var(--line)] pt-3 text-xs text-ink/60">
          {[...leitura.edicoesAdmin].reverse().map((e) => (
            <li key={e.em}>
              {new Date(e.em).toLocaleString("pt-BR")} · {e.por}: {mesBR(e.antes.mes)} → {mesBR(e.depois.mes)}, estoque {e.antes.estoque} → {e.depois.estoque},
              vendas {e.antes.vendas ?? "—"} → {e.depois.vendas}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
