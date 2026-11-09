"use client";

import { useEffect, useRef } from "react";

/**
 * Modal acessível reutilizável (FASE 10 — refinamento de UX/a11y).
 * - role="dialog" + aria-modal e aria-label/labelledby;
 * - fecha com Esc e com clique no backdrop;
 * - move o foco para dentro ao abrir e o devolve ao fechar;
 * - trava o scroll do fundo enquanto aberto.
 */
export default function Modal({
  titulo,
  onFechar,
  children,
  alinhamento = "centro",
  largura = "larga",
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  alinhamento?: "centro" | "base";
  /** "larga" para formulários de cadastro; "estreita" para confirmações. */
  largura?: "larga" | "estreita";
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focoAnterior.current = document.activeElement as HTMLElement | null;
    // Foca o primeiro elemento interativo do painel, ou o próprio painel.
    const alvo = painelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    (alvo ?? painelRef.current)?.focus();

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
      focoAnterior.current?.focus?.();
    };
  }, [onFechar]);

  const posicao =
    alinhamento === "base"
      ? "items-end sm:items-center"
      : "items-center";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/40 p-4 ${posicao}`}
      onMouseDown={(e) => {
        // Fecha só quando o clique começa no backdrop, não ao arrastar de dentro.
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`w-full ${largura === "larga" ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-[var(--surface)] p-6 shadow-xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
