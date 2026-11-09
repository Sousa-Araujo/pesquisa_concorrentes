"use client";

/**
 * Resumo da lista de unidades lida: por torre (quando a identificação traz a
 * torre, ex.: "121 NYC") com a contagem por status e o ticket médio das
 * disponíveis. A lista completa fica recolhida em "Ver todas as unidades".
 */
import type { StatusUnidade, Unidade } from "@/lib/domain/tabelas";

export const ROTULO_STATUS: Record<StatusUnidade, string> = {
  disponivel: "Disponível", reservada: "Reservada", vendida: "Vendida", outro: "Outro",
};

export const brl = (c: number | null | undefined) =>
  c == null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "121 NYC" → "NYC"; "Apto 32 Torre B" → "Torre B"; "101" → null. */
function torreDe(unidade: string): string | null {
  const m = unidade.trim().match(/^(?:apto\.?\s*)?\d+[a-z]?\s*[-–]?\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

const media = (vs: (number | null | undefined)[]) => {
  const ok = vs.filter((v): v is number => v != null && v > 0);
  return ok.length ? Math.round(ok.reduce((a, v) => a + v, 0) / ok.length) : null;
};

interface Linha { nome: string; total: number; disp: number; res: number; vend: number; outro: number; ticket: number | null; ticketDesc: number | null }

function linha(nome: string, us: Unidade[]): Linha {
  const disp = us.filter((u) => u.status === "disponivel");
  return {
    nome, total: us.length, disp: disp.length,
    res: us.filter((u) => u.status === "reservada").length,
    vend: us.filter((u) => u.status === "vendida").length,
    outro: us.filter((u) => u.status === "outro").length,
    ticket: media(disp.map((u) => u.valorCentavos)),
    ticketDesc: media(disp.map((u) => u.valorDescontoCentavos)),
  };
}

export default function ResumoUnidades({ unidades, editadas, temDesconto }: { unidades: Unidade[]; editadas: Set<number>; temDesconto: boolean }) {
  const torres = new Map<string, Unidade[]>();
  for (const u of unidades) {
    const t = torreDe(u.unidade) ?? "Sem torre";
    torres.set(t, [...(torres.get(t) ?? []), u]);
  }
  const porTorre = torres.size > 1 || (torres.size === 1 && !torres.has("Sem torre"));
  const linhas = porTorre ? [...torres].map(([t, us]) => linha(t, us)) : [];
  const total = linha("Total", unidades);
  const temOutro = total.outro > 0;

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink/50">
              <th className="px-2 py-2 font-medium">{porTorre ? "Torre" : ""}</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Disp.</th>
              <th className="px-2 py-2 text-right font-medium">Reserv.</th>
              <th className="px-2 py-2 text-right font-medium">Vend.</th>
              {temOutro && <th className="px-2 py-2 text-right font-medium">Outras</th>}
              <th className="px-2 py-2 text-right font-medium">Ticket tabela</th>
              {temDesconto && <th className="px-2 py-2 text-right font-medium">Ticket c/ desc.</th>}
            </tr>
          </thead>
          <tbody>
            {[...linhas, total].map((l) => (
              <tr key={l.nome} className={`border-b border-[var(--line)] ${l.nome === "Total" ? "font-bold text-ink" : ""}`}>
                <td className="px-2 py-2">{l.nome}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.total}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.disp}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.res}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.vend}</td>
                {temOutro && <td className="px-2 py-2 text-right tabular-nums">{l.outro}</td>}
                <td className="px-2 py-2 text-right tabular-nums">{brl(l.ticket)}</td>
                {temDesconto && <td className="px-2 py-2 text-right tabular-nums">{brl(l.ticketDesc)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-[var(--line)]">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink">Ver todas as unidades ({unidades.length})</summary>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--surface)]">
              <tr className="border-b border-[var(--line)] text-left text-ink/50">
                <th className="px-3 py-2 font-medium">Unidade</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Valor de tabela</th>
                {temDesconto && <th className="px-3 py-2 text-right font-medium">Com desconto</th>}
              </tr>
            </thead>
            <tbody>
              {unidades.map((u, i) => (
                <tr key={i} className="border-b border-[var(--line)]">
                  <td className="px-3 py-1.5">
                    {u.unidade || <span className="text-ink/40">(sem nome)</span>}
                    {editadas.has(i) && <span className="ml-2 rounded-full bg-[var(--warning-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-ink)]">editada</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    {ROTULO_STATUS[u.status]}
                    {u.statusOriginal && u.statusOriginal !== ROTULO_STATUS[u.status] && <span className="ml-1 text-xs text-ink/40">“{u.statusOriginal}”</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{brl(u.valorCentavos)}</td>
                  {temDesconto && <td className="px-3 py-1.5 text-right tabular-nums">{brl(u.valorDescontoCentavos)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
