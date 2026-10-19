"use client";

/**
 * Popup da conferência: quem valida escolhe a unidade (com busca) e corrige
 * identificação, status e valores; também inclui ou exclui unidade.
 * As mudanças ficam na tela até "Salvar conferência" ou "Aprovar".
 */
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import type { StatusUnidade, Unidade } from "@/lib/domain/tabelas";
import { ROTULO_STATUS, brl } from "./ResumoUnidades";

const paraCentavos = (txt: string) => { const d = txt.replace(/\D/g, ""); return d ? Number(d) * 100 : null; };
const paraTexto = (c: number | null | undefined) => (c != null ? String(Math.round(c / 100)) : "");

export default function EditarUnidade({ unidades, novo, onAplicar, onExcluir, onFechar }: {
  unidades: Unidade[];
  /** true = incluir unidade nova (sem escolher da lista). */
  novo: boolean;
  onAplicar: (indice: number | null, u: Unidade) => void;
  onExcluir: (indice: number) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState<number | null>(null);
  const [form, setForm] = useState({ unidade: "", status: "disponivel" as StatusUnidade, tabela: "", desconto: "" });
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return unidades.map((u, i) => ({ u, i })).filter(({ u }) => !b || u.unidade.toLowerCase().includes(b));
  }, [unidades, busca]);

  function escolher(i: number) {
    const u = unidades[i];
    setIndice(i);
    setErro(null);
    setForm({ unidade: u.unidade, status: u.status, tabela: paraTexto(u.valorCentavos), desconto: paraTexto(u.valorDescontoCentavos) });
  }

  function aplicar() {
    if (!form.unidade.trim()) { setErro("Informe a identificação da unidade."); return; }
    const repetida = unidades.findIndex((u, i) => i !== indice && u.unidade.trim().toLowerCase() === form.unidade.trim().toLowerCase());
    if (repetida >= 0) { setErro("Já existe uma unidade com essa identificação."); return; }
    const original = indice !== null ? unidades[indice] : null;
    onAplicar(indice, {
      unidade: form.unidade.trim(),
      status: form.status,
      valorCentavos: paraCentavos(form.tabela),
      valorDescontoCentavos: paraCentavos(form.desconto),
      statusOriginal: original?.statusOriginal,
    });
  }

  const editando = novo || indice !== null;

  return (
    <Modal titulo={novo ? "Incluir unidade" : "Editar unidade"} onFechar={onFechar}>
      <h2 className="mb-4 text-lg font-bold text-ink">{novo ? "Incluir unidade" : "Editar unidade"}</h2>

      {!novo && (
        <div className="mb-4 grid gap-2">
          <label className="rotulo" htmlFor="busca-unidade">Escolha a unidade</label>
          <input id="busca-unidade" className="campo" placeholder="Digite para buscar (ex.: 93 NYC)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-48 overflow-auto rounded-lg border border-[var(--line)]">
            {opcoes.length === 0 && <p className="px-3 py-2 text-sm text-ink/50">Nenhuma unidade encontrada.</p>}
            {opcoes.map(({ u, i }) => (
              <button key={i} type="button" onClick={() => escolher(i)}
                className={`flex w-full items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--surface-2)] ${indice === i ? "bg-[var(--surface-2)] font-semibold" : ""}`}>
                <span>{u.unidade}</span>
                <span className="text-xs text-ink/60">{ROTULO_STATUS[u.status]} · {brl(u.valorCentavos)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {editando && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="ed-unidade">Unidade</label>
            <input id="ed-unidade" className="campo" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ed-status">Status</label>
            <select id="ed-status" className="campo" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusUnidade })}>
              {(Object.keys(ROTULO_STATUS) as StatusUnidade[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="ed-tabela">Valor de tabela (R$)</label>
            <input id="ed-tabela" className="campo" inputMode="numeric" value={form.tabela} onChange={(e) => setForm({ ...form, tabela: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ed-desconto">Com desconto (R$, opcional)</label>
            <input id="ed-desconto" className="campo" inputMode="numeric" value={form.desconto} onChange={(e) => setForm({ ...form, desconto: e.target.value.replace(/\D/g, "") })} />
          </div>
          {indice !== null && unidades[indice].statusOriginal && (
            <p className="text-xs text-ink/50 sm:col-span-2">No documento: “{unidades[indice].statusOriginal}”.</p>
          )}
        </div>
      )}

      {erro && <p className="mt-3 rounded-lg bg-[var(--critical-tint)] px-4 py-2 text-sm text-[var(--critical-ink)]" role="alert">{erro}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {indice !== null && (
            <button type="button" className="btn-acao btn-acao--perigo" onClick={() => onExcluir(indice)}>
              <Trash2 size={13} aria-hidden="true" />Excluir unidade
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secundario" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={aplicar} disabled={!editando}>{novo ? "Incluir" : "Aplicar"}</button>
        </div>
      </div>
    </Modal>
  );
}
