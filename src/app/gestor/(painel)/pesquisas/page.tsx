import { exigirPagina } from "@/lib/auth/acesso";
import { listarPesquisas, listarAgentesOpcoes } from "@/lib/data/gestor";
import {
  listarRegionais, listarCidades, listarEmpreendimentos, listarConcorrentes,
} from "@/lib/data/hierarquia";
import { formatarCompetenciaCurta } from "@/lib/domain/competencia";
import FiltrosPesquisas from "./FiltrosPesquisas";
import AcoesPesquisa from "./AcoesPesquisa";

export const dynamic = "force-dynamic";

const PAGINA = 50;

type Ordenavel = "data" | "concorrente" | "estoque" | "vendas";
const CHAVES_ORDENAVEIS: Ordenavel[] = ["data", "concorrente", "estoque", "vendas"];

export default async function PesquisasPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    p?: string; mes?: string; regional?: string; cidade?: string;
    emp?: string; conc?: string; agente?: string; sort?: string; dir?: string;
  }>;
}) {
  await exigirPagina("painelPesquisa");
  const searchParams = await searchParamsPromise;
  const pagina = Math.max(1, Number(searchParams.p ?? "1"));
  const offset = (pagina - 1) * PAGINA;

  const mesAno = searchParams.mes || undefined;
  const regional = searchParams.regional || "";
  const idCidade = searchParams.cidade ? Number(searchParams.cidade) : undefined;
  const idEmp = searchParams.emp ? Number(searchParams.emp) : undefined;
  const idConc = searchParams.conc ? Number(searchParams.conc) : undefined;
  const idAgente = searchParams.agente || undefined;

  const ordenarPor: Ordenavel = CHAVES_ORDENAVEIS.includes(searchParams.sort as Ordenavel)
    ? (searchParams.sort as Ordenavel)
    : "data";
  const direcao: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";

  // Opções para os selects (dependentes onde a hierarquia exige).
  const [regionais, agentes] = await Promise.all([
    listarRegionais(),
    listarAgentesOpcoes(),
  ]);
  const cidades = regional ? await listarCidades(regional) : [];
  const emps = idCidade ? await listarEmpreendimentos(idCidade) : [];
  const concs = idEmp ? await listarConcorrentes(idEmp) : [];

  const linhas = await listarPesquisas({
    mesAno,
    regional: regional || undefined,
    idCidade,
    idEmpreendimento: idEmp,
    idConcorrente: idConc,
    idAgente,
    limite: PAGINA,
    offset,
    ordenarPor,
    direcao,
  });

  // Preserva filtros + ordenação ativos ao trocar de página ou de coluna.
  const qs = (over: { p?: number; sort?: Ordenavel; dir?: "asc" | "desc" }) => {
    const params = new URLSearchParams();
    if (searchParams.mes) params.set("mes", searchParams.mes);
    if (regional) params.set("regional", regional);
    if (searchParams.cidade) params.set("cidade", searchParams.cidade);
    if (searchParams.emp) params.set("emp", searchParams.emp);
    if (searchParams.conc) params.set("conc", searchParams.conc);
    if (idAgente) params.set("agente", idAgente);
    params.set("sort", over.sort ?? ordenarPor);
    params.set("dir", over.dir ?? direcao);
    params.set("p", String(over.p ?? pagina));
    return `/gestor/pesquisas?${params.toString()}`;
  };

  // Clicar na coluna já ativa inverte a direção; trocar de coluna começa em desc.
  function hrefOrdenar(coluna: Ordenavel) {
    const novaDirecao = coluna === ordenarPor && direcao === "desc" ? "asc" : "desc";
    return qs({ sort: coluna, dir: novaDirecao, p: 1 });
  }

  function CabecalhoOrdenavel({ coluna, children, alinhar }: {
    coluna: Ordenavel; children: React.ReactNode; alinhar?: "right";
  }) {
    return (
      <th className={`px-4 py-3 font-medium ${alinhar === "right" ? "text-right" : ""}`}>
        <a href={hrefOrdenar(coluna)} className="inline-flex items-center gap-1 hover:text-ink"
          aria-label={`Ordenar por ${children}`}>
          {children}
          {ordenarPor === coluna && <span aria-hidden>{direcao === "asc" ? "▲" : "▼"}</span>}
        </a>
      </th>
    );
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold text-ink">Pesquisas realizadas</h1>

      <FiltrosPesquisas
        mes={searchParams.mes ?? ""}
        regional={regional}
        idCidade={searchParams.cidade ?? ""}
        idEmp={searchParams.emp ?? ""}
        idConc={searchParams.conc ?? ""}
        idAgente={idAgente ?? ""}
        regionais={regionais.map((r) => r.regional)}
        cidades={cidades.map((c) => ({ id: c.id_cidade, nome: c.cidade }))}
        emps={emps.map((e) => ({ id: e.id_empreendimento, nome: e.empreendimento }))}
        concs={concs.map((c) => ({ id: c.id_concorrente, nome: c.concorrente }))}
        agentes={agentes}
      />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-ink/50">
              <CabecalhoOrdenavel coluna="data">Data/hora</CabecalhoOrdenavel>
              <th className="px-4 py-3 font-medium">Agente</th>
              <th className="px-4 py-3 font-medium">Regional</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 font-medium">Empreendimento</th>
              <CabecalhoOrdenavel coluna="concorrente">Concorrente</CabecalhoOrdenavel>
              <th className="px-4 py-3 font-medium">Comp.</th>
              <CabecalhoOrdenavel coluna="estoque" alinhar="right">Estoque</CabecalhoOrdenavel>
              <CabecalhoOrdenavel coluna="vendas" alinhar="right">Vendas</CabecalhoOrdenavel>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-ink/50">
                Nenhuma pesquisa encontrada para os filtros aplicados.
              </td></tr>
            )}
            {linhas.map((l) => (
              <tr key={l.id_coleta} className="border-b border-black/[.04]">
                <td className="px-4 py-3 text-ink/70">
                  {new Date(l.coletado_em).toLocaleString("pt-BR")}
                  {new Date(l.atualizado_em) > new Date(l.coletado_em) && (
                    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-xs text-ink/50"
                      title={`Editado em ${new Date(l.atualizado_em).toLocaleString("pt-BR")}`}>
                      editado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{l.agente}</td>
                <td className="px-4 py-3">{l.regional}</td>
                <td className="px-4 py-3">{l.cidade}</td>
                <td className="px-4 py-3">{l.empreendimento}</td>
                <td className="px-4 py-3">{l.concorrente}</td>
                <td className="px-4 py-3">{formatarCompetenciaCurta(l.mes_ano)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.estoque}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.vendas}</td>
                <td className="px-4 py-3 text-right">
                  <AcoesPesquisa coleta={{
                    id_coleta: l.id_coleta,
                    concorrente: l.concorrente,
                    empreendimento: l.empreendimento,
                    mes_ano: l.mes_ano,
                    estoque: l.estoque,
                    vendas: l.vendas,
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <a className="btn-ghost aria-disabled:pointer-events-none aria-disabled:opacity-40"
          aria-disabled={pagina <= 1}
          href={pagina > 1 ? qs({ p: pagina - 1 }) : undefined}>
          ← Anterior
        </a>
        <span className="text-ink/50">Página {pagina}</span>
        <a className="btn-ghost aria-disabled:pointer-events-none aria-disabled:opacity-40"
          aria-disabled={linhas.length < PAGINA}
          href={linhas.length === PAGINA ? qs({ p: pagina + 1 }) : undefined}>
          Próxima →
        </a>
      </div>
    </div>
  );
}
