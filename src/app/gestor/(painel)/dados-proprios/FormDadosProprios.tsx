"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DialogoConfirmacao from "@/components/DialogoConfirmacao";
import { formatarCompetenciaLonga } from "@/lib/domain/competencia";
import { salvarDadosProprios, excluirDadosProprios } from "../../actions";
import CampoData from "@/components/CampoData";

type Item = { id: number; nome: string };

export default function FormDadosProprios({
  mesAno, regional, idCidade, idEmp, regionais, cidades, emps, atual, vendasCV,
}: {
  mesAno: string;
  regional: string;
  idCidade: string;
  idEmp: string;
  regionais: string[];
  cidades: Item[];
  emps: Item[];
  atual: { estoque: number; vendas: number; origem: "cv" | "manual" } | null;
  /** Vendas do empreendimento no CV nesta competência (null = sem ligação com o CV). */
  vendasCV: number | null;
}) {
  const router = useRouter();
  // Sem registro no mês, as vendas já vêm do CV.
  const vendasIniciais = atual ? String(atual.vendas) : vendasCV !== null ? String(vendasCV) : "";
  const [estoque, setEstoque] = useState(atual ? String(atual.estoque) : "");
  const [vendas, setVendas] = useState(vendasIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Ressincroniza quando a seleção (e portanto os dados atuais) muda.
  useEffect(() => {
    setEstoque(atual ? String(atual.estoque) : "");
    setVendas(atual ? String(atual.vendas) : vendasCV !== null ? String(vendasCV) : "");
    setOk(false);
    setConfirmandoExclusao(false);
    setErroExcluir(null);
  }, [atual, idEmp, mesAno, vendasCV]);

  function navegar(next: Partial<{ mes: string; regional: string; cidade: string; emp: string }>) {
    const params = new URLSearchParams({ mes: mesAno });
    if (regional) params.set("regional", regional);
    if (idCidade) params.set("cidade", idCidade);
    if (idEmp) params.set("emp", idEmp);
    Object.entries(next).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (next.regional !== undefined) { params.delete("cidade"); params.delete("emp"); }
    if (next.cidade !== undefined) { params.delete("emp"); }
    router.push(`/gestor/dados-proprios?${params.toString()}`);
  }

  async function salvar() {
    setErro(null); setOk(false);
    if (!idEmp || estoque === "" || vendas === "") {
      setErro("Selecione o empreendimento e informe estoque e vendas.");
      return;
    }
    setSalvando(true);
    const r = await salvarDadosProprios({
      id_empreendimento: Number(idEmp),
      mes_ano: mesAno,
      estoque: Number(estoque),
      vendas: Number(vendas),
    });
    setSalvando(false);
    if (r.ok) { setOk(true); router.refresh(); }
    else setErro(r.erro);
  }

  async function excluir() {
    setErroExcluir(null);
    setExcluindo(true);
    const r = await excluirDadosProprios(Number(idEmp), mesAno);
    setExcluindo(false);
    if (r.ok) {
      setConfirmandoExclusao(false);
      router.refresh();
    } else {
      setErroExcluir(r.erro);
    }
  }

  return (
    <div className="card grid max-w-4xl gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <label className="rotulo">Competência</label>
          <CampoData tipo="mes" value={mesAno.slice(0, 7)}
            onChange={(v) => v && navegar({ mes: `${v}-01` })} />
        </div>
        <div>
          <label className="rotulo">Regional</label>
          <select className="campo !text-base !py-2" value={regional}
            onChange={(e) => navegar({ regional: e.target.value })}>
            <option value="">Selecione…</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Cidade</label>
          <select className="campo !text-base !py-2" value={idCidade} disabled={!regional}
            onChange={(e) => navegar({ cidade: e.target.value })}>
            <option value="">Selecione…</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Empreendimento</label>
          <select className="campo !text-base !py-2" value={idEmp} disabled={!idCidade}
            onChange={(e) => navegar({ emp: e.target.value })}>
            <option value="">Selecione…</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      </div>

      {idEmp && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="rotulo">Estoque atual</label>
              <input className="campo !text-base !py-2" inputMode="numeric" pattern="[0-9]*"
                value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <label className="rotulo">Vendas no mês</label>
              <input className="campo !text-base !py-2" inputMode="numeric" pattern="[0-9]*"
                value={vendas} onChange={(e) => setVendas(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          {vendasCV !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand/5 px-4 py-3 text-sm text-ink/80">
              <span>Vendas no CV em {formatarCompetenciaLonga(mesAno)}: <b className="tabular-nums">{vendasCV}</b></span>
              {String(vendasCV) !== vendas && (
                <button type="button" className="btn-acao" onClick={() => setVendas(String(vendasCV))}>Usar vendas do CV</button>
              )}
            </div>
          )}
          {atual && (
            <p className="text-xs text-ink/50">
              {atual.origem === "cv"
                ? "Estes números vieram do CV e são atualizados sozinhos. Se você salvar, passam a valer os números digitados aqui."
                : "Já existe registro digitado nesta competência. Salvar irá atualizá-lo."}
            </p>
          )}
          {erro && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
          {ok && <p className="rounded-lg bg-brand/10 px-4 py-3 text-sm text-brand">Dados salvos.</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary !py-3" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar dados próprios"}
            </button>
            {atual && (
              <button
                className="rounded-xl border border-red-200 px-4 py-3 font-medium text-red-600 hover:bg-red-50"
                onClick={() => setConfirmandoExclusao(true)}
              >
                Excluir registro
              </button>
            )}
          </div>
        </>
      )}

      {confirmandoExclusao && (
        <DialogoConfirmacao
          titulo="Excluir dados próprios"
          mensagem={
            <>
              Excluir o registro de estoque e vendas próprios desta competência
              ({formatarCompetenciaLonga(mesAno)})? A ação fica registrada em auditoria,
              mas o empreendimento sai do comparativo até novo cadastro.
            </>
          }
          processando={excluindo}
          erro={erroExcluir}
          onConfirmar={excluir}
          onCancelar={() => { setConfirmandoExclusao(false); setErroExcluir(null); }}
        />
      )}
    </div>
  );
}
