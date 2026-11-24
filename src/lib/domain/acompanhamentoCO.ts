/**
 * Acompanhamento do Cliente Oculto no mês (regras puras, sem banco).
 *
 * Universo esperado do mês: cada empreendimento Sousa ativo e cada
 * concorrente ativo deveria ter pelo menos uma visita. Uma visita conta como
 * REALIZADA quando já foi enviada pelo avaliador (aguardando calibragem ou
 * concluída); rascunho ("em preenchimento") ainda não conta e fica entre as
 * NÃO REALIZADAS, junto de quem não tem nenhuma visita no mês.
 */
import { nomeComparavel } from "./comparativo";

export type SituacaoVisita = "concluida" | "calibragem" | "rascunho" | "sem_visita";

export interface AlvoPesquisa {
  tipo: "sousa" | "concorrente";
  /** id_empreendimento (Sousa) ou id_concorrente (concorrente). */
  id: number;
  nome: string;
  /** Concorrente: o empreendimento Sousa que ele acompanha. */
  referencia: string | null;
  regional: string;
}

export interface VisitaDoMes {
  id: string;
  status: string;
  tipo: string | null;
  idEmpreendimento: number | null;
  idConcorrente: number | null;
  nomeTexto: string | null;
  dataVisita: string | null;
  somentePrevia: boolean;
}

export interface ItemAcompanhamento extends AlvoPesquisa {
  situacao: SituacaoVisita;
  visitas: number;
  /** Visita que decidiu a situação (a mais avançada do mês). */
  avaliacaoId: string | null;
  dataVisita: string | null;
  somentePrevia: boolean;
}

const PESO: Record<SituacaoVisita, number> = { concluida: 3, calibragem: 2, rascunho: 1, sem_visita: 0 };

export function situacaoDaVisita(status: string): SituacaoVisita {
  if (status === "Concluída") return "concluida";
  if (status === "Aguardando Calibragem") return "calibragem";
  return "rascunho";
}

export const foiRealizada = (s: SituacaoVisita) => s === "concluida" || s === "calibragem";

/** Visita do mês que pertence ao alvo: pelo cadastro e, nas antigas sem ligação, pelo nome. */
function pertence(a: AlvoPesquisa, v: VisitaDoMes): boolean {
  if (a.tipo === "sousa") {
    if (v.tipo === "concorrente") return false;
    return v.idEmpreendimento === a.id || (v.idEmpreendimento === null && nomeComparavel(v.nomeTexto) === nomeComparavel(a.nome));
  }
  if (v.tipo !== "concorrente") return false;
  return v.idConcorrente === a.id || (v.idConcorrente === null && nomeComparavel(v.nomeTexto) === nomeComparavel(a.nome));
}

export function montarAcompanhamento(alvos: AlvoPesquisa[], visitas: VisitaDoMes[]): ItemAcompanhamento[] {
  return alvos.map((a) => {
    const minhas = visitas.filter((v) => pertence(a, v));
    let melhor: VisitaDoMes | null = null;
    for (const v of minhas) {
      if (!melhor || PESO[situacaoDaVisita(v.status)] > PESO[situacaoDaVisita(melhor.status)]) melhor = v;
    }
    return {
      ...a,
      situacao: melhor ? situacaoDaVisita(melhor.status) : "sem_visita",
      visitas: minhas.length,
      avaliacaoId: melhor?.id ?? null,
      dataVisita: melhor?.dataVisita ?? null,
      somentePrevia: melhor?.somentePrevia ?? false,
    };
  });
}

export interface ResumoAcompanhamento {
  esperadas: number;
  realizadas: number;
  naoRealizadas: number;
  concluidas: number;
  emCalibragem: number;
  rascunhos: number;
  semVisita: number;
  /** 0..1 (0 quando não há nada esperado). */
  cumprimento: number;
}

export function resumirAcompanhamento(itens: ItemAcompanhamento[]): ResumoAcompanhamento {
  const conta = (s: SituacaoVisita) => itens.filter((i) => i.situacao === s).length;
  const realizadas = itens.filter((i) => foiRealizada(i.situacao)).length;
  return {
    esperadas: itens.length,
    realizadas,
    naoRealizadas: itens.length - realizadas,
    concluidas: conta("concluida"),
    emCalibragem: conta("calibragem"),
    rascunhos: conta("rascunho"),
    semVisita: conta("sem_visita"),
    cumprimento: itens.length ? realizadas / itens.length : 0,
  };
}
