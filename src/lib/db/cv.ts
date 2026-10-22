/**
 * Leitura do BI comercial do CV (schema bi_mcp_comercial), banco externo
 * indicado em CV_DATABASE_URL. Só leitura: toda sessão abre com
 * default_transaction_read_only e um tempo máximo por consulta.
 */
import "server-only";
import { Pool } from "pg";

let pool: Pool | null = null;

export function cvConfigurado(): boolean {
  return Boolean(process.env.CV_DATABASE_URL);
}

function cvDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.CV_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      // As visões de indicadores do BI são pesadas (10–20 s); roda em segundo plano.
      options: "-c default_transaction_read_only=on -c statement_timeout=180000",
    });
  }
  return pool;
}

export interface EmpreendimentoCV { id: number; nome: string; regiao: string | null; ativo: boolean }

export async function lerEmpreendimentosCV(): Promise<EmpreendimentoCV[]> {
  const { rows } = await cvDb().query(
    `select empreendimento_id, empreendimento, regiao_sigla, ativo
       from bi_mcp_comercial.dim_empreendimento order by empreendimento`,
  );
  return rows.map((r) => ({
    id: Number(r.empreendimento_id), nome: String(r.empreendimento),
    regiao: r.regiao_sigla ?? null, ativo: r.ativo === true || r.ativo === "S" || r.ativo === "Sim",
  }));
}

export interface EstoqueCV {
  id: number; disponiveis: number; reservadas: number; bloqueadas: number; vendidas: number;
  /** Ticket de tabela vigente das unidades não vendidas, em centavos. */
  ticketTabelaCentavos: number | null;
}

/** Foto atual do estoque por empreendimento (o BI não guarda o histórico). */
export async function lerEstoqueAtual(ids: number[]): Promise<EstoqueCV[]> {
  if (!ids.length) return [];
  // Duas consultas separadas: juntar as duas visões no banco passa de um minuto.
  const { rows } = await cvDb().query(
    `select empreendimento_id,
            sum(disponiveis)::int as disponiveis, sum(bloqueadas)::int as bloqueadas, sum(vendidas)::int as vendidas,
            sum(total_unidades)::int as total
       from bi_mcp_comercial.kpi_estoque_por_empreendimento
      where empreendimento_id = any($1)
      group by empreendimento_id`,
    [ids],
  );
  const { rows: tickets } = await cvDb().query(
    `select empreendimento_id, ticket_tabela_vigente as ticket
       from bi_mcp_comercial.kpi_ticket_tabela_vigente where empreendimento_id = any($1)`,
    [ids],
  );
  const ticketDe = new Map(tickets.map((t) => [Number(t.empreendimento_id), t.ticket]));
  return rows.map((r) => ({
    id: Number(r.empreendimento_id),
    disponiveis: r.disponiveis, bloqueadas: r.bloqueadas, vendidas: r.vendidas,
    reservadas: Math.max(0, r.total - r.disponiveis - r.bloqueadas - r.vendidas),
    ticketTabelaCentavos: ticketDe.get(Number(r.empreendimento_id)) ? Math.round(Number(ticketDe.get(Number(r.empreendimento_id))) * 100) : null,
  }));
}

export interface VendasMesCV {
  id: number; mesAno: string; vendas: number;
  /** Média do valor de contrato (já com desconto), em centavos. */
  ticketDescontoCentavos: number | null;
  descontoPct: number | null;
}

/** Vendas por empreendimento e mês desde `desde` (YYYY-MM-01). */
export async function lerVendasMensais(ids: number[], desde: string): Promise<VendasMesCV[]> {
  if (!ids.length) return [];
  const { rows } = await cvDb().query(
    `select _empreendimento_id as id, to_char(date_trunc('month', _data_venda), 'YYYY-MM-DD') as mes,
            count(*)::int as vendas, avg(valor_contrato) as ticket, avg(desconto_pct) as desconto
       from bi_mcp_comercial.fato_venda
      where _empreendimento_id = any($1) and _data_venda >= $2::date
      group by 1, 2`,
    [ids, desde],
  );
  return rows.map((r) => ({
    id: Number(r.id), mesAno: r.mes, vendas: r.vendas,
    ticketDescontoCentavos: r.ticket ? Math.round(Number(r.ticket) * 100) : null,
    descontoPct: r.desconto !== null && r.desconto !== undefined ? Number(r.desconto) : null,
  }));
}
