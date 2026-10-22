/**
 * Dados do CV (administrador): ligação de cada empreendimento Sousa com o
 * empreendimento do BI comercial do CV e os números do mês que vieram de lá.
 */
import { redirect } from "next/navigation";
import { exigirPagina } from "@/lib/auth/acesso";
import { db } from "@/lib/db/pool";
import { cvConfigurado, lerEmpreendimentosCV, type EmpreendimentoCV } from "@/lib/db/cv";
import { competenciaVigente, formatarCompetenciaLonga } from "@/lib/domain/competencia";
import DadosCV, { type LinhaCV } from "./DadosCV";

export const dynamic = "force-dynamic";

export default async function DadosCVPage() {
  const u = await exigirPagina("gerirUsuarios");
  if (!u.perfis.includes("admin")) redirect("/inicio");
  const mes = competenciaVigente();

  let cv: EmpreendimentoCV[] = [];
  let erroCV: string | null = null;
  if (!cvConfigurado()) erroCV = "A variável CV_DATABASE_URL não está configurada neste ambiente.";
  else {
    try { cv = await lerEmpreendimentosCV(); } catch { erroCV = "Não foi possível ler o BI do CV agora."; }
  }

  const { rows } = await db().query(
    `select e.id_empreendimento, e.empreendimento, c.regional, e.id_cv, e.id_cv_manual,
            d.estoque, d.reservadas, d.vendas, d.ticket_tabela_centavos, d.ticket_desconto_centavos, d.origem, d.atualizado_em
       from empreendimentos e
       join cidades c on c.id_cidade = e.id_cidade
       left join dados_proprios_mensais d on d.id_empreendimento = e.id_empreendimento and d.mes_ano = $1
      where e.ativo
      order by c.regional, e.empreendimento`,
    [mes],
  );
  const { rows: [sync] } = await db().query(`select ultima_em, ok, mensagem from cv_sincronizacao where id = 1`);

  const linhas: LinhaCV[] = rows.map((r) => ({
    id: r.id_empreendimento,
    nome: r.empreendimento,
    regional: r.regional,
    idCv: r.id_cv,
    manual: r.id_cv_manual,
    estoque: r.estoque,
    reservadas: r.reservadas,
    vendas: r.vendas,
    ticketTabela: r.ticket_tabela_centavos ? Number(r.ticket_tabela_centavos) : null,
    ticketDesconto: r.ticket_desconto_centavos ? Number(r.ticket_desconto_centavos) : null,
    origem: r.origem ?? null,
  }));

  return (
    <DadosCV
      linhas={linhas}
      opcoes={cv.map((c) => ({ id: c.id, nome: c.nome, regiao: c.regiao }))}
      erroCV={erroCV}
      mesRotulo={formatarCompetenciaLonga(mes)}
      sincronizacao={sync ? { em: sync.ultima_em ? new Date(sync.ultima_em).toISOString() : null, ok: sync.ok, mensagem: sync.mensagem } : null}
    />
  );
}
