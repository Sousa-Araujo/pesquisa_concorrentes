/**
 * Dados do dashboard de acompanhamento do Cliente Oculto: o que era esperado
 * no mês (empreendimentos Sousa e concorrentes ativos) e as visitas feitas.
 * Regras em src/lib/domain/acompanhamentoCO.ts.
 */
import "server-only";
import { db } from "@/lib/db/pool";
import {
  montarAcompanhamento, type AlvoPesquisa, type ItemAcompanhamento, type VisitaDoMes,
} from "@/lib/domain/acompanhamentoCO";

/** Itens esperados e o que aconteceu no mês (mesAno = "YYYY-MM-01"). */
export async function acompanhamentoDoMes(mesAno: string): Promise<ItemAcompanhamento[]> {
  const [{ rows: sousa }, { rows: concs }, { rows: visitas }] = await Promise.all([
    db().query<{ id: number; nome: string; regional: string }>(
      `select e.id_empreendimento as id, e.empreendimento as nome, c.regional
         from empreendimentos e join cidades c on c.id_cidade = e.id_cidade
        where e.ativo order by c.regional, e.empreendimento`,
    ),
    db().query<{ id: number; nome: string; referencia: string; regional: string }>(
      `select k.id_concorrente as id, k.concorrente as nome, e.empreendimento as referencia, c.regional
         from concorrentes k
         join empreendimentos e on e.id_empreendimento = k.id_empreendimento
         join cidades c on c.id_cidade = e.id_cidade
        where k.ativo order by c.regional, k.concorrente`,
    ),
    db().query<{
      id: string; status: string; tipo: string | null; id_empreendimento: number | null; id_concorrente: number | null;
      nome_texto: string | null; data_visita: string | null; somente_previa: boolean;
    }>(
      `select id, status, tipo_empreendimento as tipo, id_empreendimento, id_concorrente,
              empreendimento_texto as nome_texto, to_char(data_visita, 'YYYY-MM-DD') as data_visita,
              coalesce(somente_previa, false) as somente_previa
         from co_avaliacoes
        where not excluida and data_visita >= $1::date and data_visita < ($1::date + interval '1 month')`,
      [mesAno],
    ),
  ]);
  const alvos: AlvoPesquisa[] = [
    ...sousa.map((s) => ({ tipo: "sousa" as const, id: s.id, nome: s.nome, referencia: null, regional: s.regional })),
    ...concs.map((c) => ({ tipo: "concorrente" as const, id: c.id, nome: c.nome, referencia: c.referencia, regional: c.regional })),
  ];
  const v: VisitaDoMes[] = visitas.map((r) => ({
    id: r.id, status: r.status, tipo: r.tipo, idEmpreendimento: r.id_empreendimento, idConcorrente: r.id_concorrente,
    nomeTexto: r.nome_texto, dataVisita: r.data_visita, somentePrevia: r.somente_previa,
  }));
  return montarAcompanhamento(alvos, v);
}
