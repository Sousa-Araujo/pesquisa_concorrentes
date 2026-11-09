"use client";

import Modal from "./Modal";

/**
 * Confirmação para ações destrutivas (exclusão). Botão de confirmar em
 * vermelho; o de cancelar recebe o foco inicial (via ordem no DOM).
 */
export default function DialogoConfirmacao({
  titulo,
  mensagem,
  textoConfirmar = "Excluir",
  processando = false,
  erro,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensagem: React.ReactNode;
  textoConfirmar?: string;
  processando?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal titulo={titulo} onFechar={onCancelar} largura="estreita">
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-2 text-sm text-ink/70">{mensagem}</div>
      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          className="flex-1 rounded-xl border border-black/10 py-3 font-medium"
          onClick={onCancelar}
          disabled={processando}
        >
          Cancelar
        </button>
        <button
          className="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-60"
          onClick={onConfirmar}
          disabled={processando}
        >
          {processando ? "Excluindo…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
