"use client";

/**
 * Campo de data ou de mês do design system, com o calendário do Flatpickr em
 * português (o mesmo usado nas telas do Cliente Oculto, public/design/datas.js).
 * O valor continua no formato que o sistema grava: "AAAA-MM-DD" (data) ou
 * "AAAA-MM" (mês). A pessoa vê "14/10/2026" ou "outubro de 2026".
 */
import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Portuguese } from "flatpickr/dist/l10n/pt";
import monthSelectPlugin from "flatpickr/dist/plugins/monthSelect/index.js";
import "flatpickr/dist/flatpickr.min.css";
import "flatpickr/dist/plugins/monthSelect/style.css";
import type { Instance } from "flatpickr/dist/types/instance";

interface Props {
  tipo: "data" | "mes";
  value: string;
  onChange: (valor: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export default function CampoData({ tipo, value, onChange, id, className = "campo", disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const fp = useRef<Instance | null>(null);
  const aoMudar = useRef(onChange);
  aoMudar.current = onChange;

  useEffect(() => {
    if (!ref.current) return;
    const formato = tipo === "mes" ? "Y-m" : "Y-m-d";
    const visivel = tipo === "mes" ? "F \\d\\e Y" : "d/m/Y";
    fp.current = flatpickr(ref.current, {
      locale: Portuguese,
      dateFormat: formato,
      altInput: true,
      altFormat: visivel,
      altInputClass: `${className} ms-data`,
      allowInput: tipo === "data",
      disableMobile: true,
      defaultDate: value || undefined,
      plugins: tipo === "mes" ? [monthSelectPlugin({ shorthand: true, dateFormat: formato, altFormat: visivel })] : [],
      onChange: (_d, texto) => aoMudar.current(texto),
    });
    if (fp.current.altInput) fp.current.altInput.placeholder = tipo === "mes" ? "Escolha o mês" : "dd/mm/aaaa";
    // O React devolve type="text" ao campo original quando o componente redesenha;
    // escondê-lo pelo estilo evita aparecer "2026-10" ao lado de "outubro de 2026".
    ref.current.style.display = "none";
    return () => { fp.current?.destroy(); fp.current = null; };
    // O calendário é criado uma vez por tipo; o valor é sincronizado abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  useEffect(() => {
    const f = fp.current;
    if (!f) return;
    const atual = f.selectedDates[0] ? f.formatDate(f.selectedDates[0], f.config.dateFormat) : "";
    if (atual !== value) {
      if (value) f.setDate(value, false); else f.clear(false);
    }
  }, [value]);

  useEffect(() => {
    if (fp.current?.altInput) fp.current.altInput.disabled = !!disabled;
  }, [disabled]);

  return <input ref={ref} id={id} type="text" className={className} disabled={disabled} />;
}
