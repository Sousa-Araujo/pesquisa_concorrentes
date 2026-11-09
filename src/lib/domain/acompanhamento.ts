/**
 * Acompanhamento de envios da Leitura por IA: para cada concorrente ativo, se o
 * mês já tem leitura aprovada (Aprovado) ou não (Pendente). Funções puras,
 * usadas pela consulta e pela tela.
 */

export type StatusEnvio = "aprovado" | "pendente";
type StatusLeituraDoMes = "lendo" | "para_conferir" | "aprovada" | "recusada";

export interface LinhaEnvio {
  idConcorrente: number;
  concorrente: string;
  idEmpreendimento: number;
  empreendimento: string;
  idCidade: number;
  cidade: string;
  regional: string;
  status: StatusEnvio;
  /** Quando pendente com leitura em andamento: o que falta (ex.: "Aguardando conferência"). */
  detalhe: string | null;
  idLeitura: string | null;
  enviadoEm: string | null;
  enviadoPor: string | null;
  /** Estoque e vendas do mês da leitura (nulos sem leitura). */
  estoque: number | null;
  vendas: number | null;
  /** Leitura aguardando conferência: a ação vira "Conferir". */
  paraConferir: boolean;
}

export interface FiltroEnvio {
  status: "" | StatusEnvio;
  regional: string;
  idCidade: string;
  idEmpreendimento: string;
}

export interface ResumoEnvio { total: number; enviados: number; pendentes: number }

const DETALHE: Record<Exclude<StatusLeituraDoMes, "aprovada">, string> = {
  lendo: "Lendo",
  para_conferir: "Aguardando conferência",
  recusada: "Recusada, reenviar",
};

/** Só a leitura aprovada conta como enviado; as demais seguem pendentes, com o motivo. */
export function classificarEnvio(leitura: StatusLeituraDoMes | null): { status: StatusEnvio; detalhe: string | null } {
  if (leitura === "aprovada") return { status: "aprovado", detalhe: null };
  return { status: "pendente", detalhe: leitura ? DETALHE[leitura] : null };
}

export function resumirEnvios(linhas: LinhaEnvio[]): ResumoEnvio {
  const enviados = linhas.filter((l) => l.status === "aprovado").length;
  return { total: linhas.length, enviados, pendentes: linhas.length - enviados };
}

/** Filtros da tela. Status é aplicado à parte, para os indicadores seguirem contando todos os status. */
export function filtrarEnvios(linhas: LinhaEnvio[], f: Partial<FiltroEnvio>, incluirStatus = true): LinhaEnvio[] {
  return linhas.filter((l) =>
    (!f.regional || l.regional === f.regional) &&
    (!f.idCidade || String(l.idCidade) === f.idCidade) &&
    (!f.idEmpreendimento || String(l.idEmpreendimento) === f.idEmpreendimento) &&
    (!incluirStatus || !f.status || l.status === f.status));
}

/** "2026-11" ou "2026-11-01" -> "2026-11-01"; qualquer outra coisa vira null. */
export function mesDoParametro(valor: string | undefined): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/.exec(valor ?? "");
  return m ? `${m[1]}-${m[2]}-01` : null;
}
