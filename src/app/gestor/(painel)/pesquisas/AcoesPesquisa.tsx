"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import DialogoConfirmacao from "@/components/DialogoConfirmacao";
import { formatarCompetenciaCurta } from "@/lib/domain/competencia";
import { editarColeta, excluirColeta } from "../../actions";
import CampoData from "@/components/CampoData";

type Coleta = {
  id_coleta: string;
  concorrente: string;
  empreendimento: string;
  mes_ano: string;
  estoque: number;
  vendas: number;
};

export default function AcoesPesquisa({ coleta }: { coleta: Coleta }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  async function confirmarExclusao() {
    setProcessando(true);
    setErroExcluir(null);
    const r = await excluirColeta(coleta.id_coleta);
    setProcessando(false);
    if (r.ok) {
      setExcluindo(false);
      router.refresh();
    } else {
      setErroExcluir(r.erro);
    }
  }

  return (
    <>
      <div className="acoes-linha">
        <button className="btn-acao" onClick={() => setEditando(true)}><Pencil size={13} aria-hidden="true" />Editar</button>
        <button className="btn-acao btn-acao--perigo" onClick={() => setExcluindo(true)}>Excluir</button>
      </div>

      {editando && (
        <FormEdicao
          coleta={coleta}
          onFechar={() => setEditando(false)}
          onSalvo={() => { setEditando(false); router.refresh(); }}
        />
      )}

      {excluindo && (
        <DialogoConfirmacao
          titulo="Excluir coleta"
          mensagem={
            <>
              Excluir a coleta de <strong>{coleta.concorrente}</strong> ({coleta.empreendimento})
              em {formatarCompetenciaCurta(coleta.mes_ano)}? Esta ação é registrada em
              auditoria, mas o dado sai do comparativo.
            </>
          }
          processando={processando}
          erro={erroExcluir}
          onConfirmar={confirmarExclusao}
          onCancelar={() => { setExcluindo(false); setErroExcluir(null); }}
        />
      )}
    </>
  );
}

function FormEdicao({
  coleta, onFechar, onSalvo,
}: {
  coleta: Coleta;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [mes, setMes] = useState(coleta.mes_ano.slice(0, 7));
  const [estoque, setEstoque] = useState(String(coleta.estoque));
  const [vendas, setVendas] = useState(String(coleta.vendas));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!mes || estoque === "" || vendas === "") {
      setErro("Preencha competência, estoque e vendas.");
      return;
    }
    setSalvando(true);
    const r = await editarColeta(coleta.id_coleta, {
      estoque: Number(estoque),
      vendas: Number(vendas),
      mes_ano: `${mes}-01`,
    });
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  return (
    <Modal titulo="Editar coleta" onFechar={onFechar}>
      <h2 className="text-lg font-semibold text-ink">Editar coleta</h2>
      <div className="mt-1 rounded-lg bg-black/[.03] px-3 py-2 text-sm text-ink/70">
        <p className="font-medium text-ink">{coleta.concorrente}</p>
        <p>{coleta.empreendimento}</p>
      </div>
      <div className="mt-4 grid gap-4">
        <div>
          <label className="rotulo" htmlFor="ed-mes">Competência</label>
          <CampoData id="ed-mes" tipo="mes" value={mes} onChange={setMes} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="ed-estoque">Estoque</label>
            <input id="ed-estoque" className="campo !text-base !py-2" inputMode="numeric" pattern="[0-9]*"
              value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ed-vendas">Vendas</label>
            <input id="ed-vendas" className="campo !text-base !py-2" inputMode="numeric" pattern="[0-9]*"
              value={vendas} onChange={(e) => setVendas(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        {erro && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      </div>
      <div className="mt-5 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
