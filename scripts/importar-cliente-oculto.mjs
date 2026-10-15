#!/usr/bin/env node
/**
 * Importa os dados do app antigo do Cliente Oculto (Sousa-Araujo/hidden)
 * para as tabelas co_* do sistema unificado.
 *
 *   ORIGEM_DATABASE_URL=postgres://... (banco do app antigo, só leitura)
 *   DATABASE_URL=postgres://...        (banco do sistema unificado)
 *   node scripts/importar-cliente-oculto.mjs [--aplicar]
 *
 * Sem --aplicar roda tudo numa transação e desfaz no fim (simulação): mostra
 * o que seria importado sem gravar nada. Pode ser rodado mais de uma vez —
 * o que já foi importado é pulado.
 *
 * Usuários: casados pelo e-mail. Papel antigo → perfil novo
 * (avaliador → avaliador, coordenador → coordenador_market_share,
 * admin → admin); quem já existe só ganha o perfil que faltava. Ninguém
 * recebe convite automaticamente.
 *
 * O app antigo não guardava quem criou cada avaliação, então as avaliações
 * importadas ficam sem avaliador dono (só Coordenador/Admin as veem). O
 * empreendimento continua como texto (empreendimento_texto); a ligação com
 * o cadastro oficial é feita depois.
 */
import pg from "pg";

const APLICAR = process.argv.includes("--aplicar");
const PAPEL_PARA_PERFIL = { avaliador: "avaliador", coordenador: "coordenador_market_share", admin: "admin" };

function precisaSsl(url) {
  try {
    const { hostname } = new URL(url);
    return !(hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".railway.internal"));
  } catch {
    return true;
  }
}

function conectar(url) {
  return new pg.Client({ connectionString: url, ssl: precisaSsl(url) ? { rejectUnauthorized: false } : false });
}

/** Texto "YYYY-MM-DD" do app antigo → date (ou null se vier em outro formato). */
function dataOuNull(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function main() {
  const origemUrl = process.env.ORIGEM_DATABASE_URL;
  const destinoUrl = process.env.DATABASE_URL;
  if (!origemUrl || !destinoUrl) throw new Error("Defina ORIGEM_DATABASE_URL e DATABASE_URL.");
  if (origemUrl === destinoUrl) throw new Error("Origem e destino são o mesmo banco.");

  const origem = conectar(origemUrl);
  const destino = conectar(destinoUrl);
  await origem.connect();
  await destino.connect();
  const resumo = { usuariosNovos: 0, usuariosComPerfilNovo: 0, avaliacoes: 0, avaliacoesJaExistiam: 0, gaps: 0, avisos: [] };

  try {
    await origem.query("set default_transaction_read_only = on");
    await destino.query("begin");

    // ---- Usuários -------------------------------------------------------
    const { rows: usuarios } = await origem.query(`select nome, email, papel, ativo from usuarios order by id`);
    for (const u of usuarios) {
      const perfil = PAPEL_PARA_PERFIL[u.papel];
      if (!perfil) { resumo.avisos.push(`Papel desconhecido para ${u.email}: ${u.papel}`); continue; }
      const email = u.email.trim().toLowerCase();
      if (perfil !== "avaliador" && !email.endsWith("@sousaaraujo.com.br")) {
        resumo.avisos.push(`${email} (${perfil}) não é @sousaaraujo.com.br — importado mesmo assim; ajuste na tela Usuários.`);
      }
      const { rows: existe } = await destino.query(`select id_usuario, perfis from usuarios where lower(email) = $1`, [email]);
      if (!existe[0]) {
        await destino.query(`insert into usuarios (nome, email, perfis, ativo) values ($1, $2, $3, $4)`, [u.nome, email, [perfil], u.ativo]);
        resumo.usuariosNovos++;
      } else if (!existe[0].perfis.includes(perfil)) {
        await destino.query(`update usuarios set perfis = array_append(perfis, $1) where id_usuario = $2`, [perfil, existe[0].id_usuario]);
        resumo.usuariosComPerfilNovo++;
      }
    }

    // ---- Avaliações -----------------------------------------------------
    const { rows: avaliacoes } = await origem.query(`select * from avaliacoes order by created_at`);
    const importadas = [];
    for (const a of avaliacoes) {
      const { rowCount } = await destino.query(
        `insert into co_avaliacoes (
           id, status, criada_em, atualizada_em, finalizada_em, concluida_em, calibragem_aberta, excluida, excluida_em,
           tipo_empreendimento, empreendimento_texto, construtora_texto, regional, data_visita, horario,
           cliente_oculto_nome, recepcionista, corretor, area_unidade_m2, area_unidade_display,
           valor_unidade_centavos, valor_unidade_display, valor_ato_centavos, valor_ato_display,
           qtd_pre_chaves, qtd_pos_chaves, desconto_tipo, desconto_valor_centavos, desconto_percentual,
           desconto_display, previsao_entrega, campanha_vigente, vinculo_sousa_label)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
         on conflict (id) do nothing`,
        [
          a.id, a.status, a.created_at, a.updated_at, a.finalized_at, a.concluded_at, a.calibragem_aberta, a.excluida, a.excluida_em,
          a.tipo_empreendimento ?? "sousa", a.empreendimento, a.construtora, a.regional, dataOuNull(a.data_visita), a.horario,
          a.cliente_oculto, a.recepcionista, a.corretor, a.area_unidade_m2, a.area_unidade_display,
          a.valor_unidade_centavos, a.valor_unidade_display, a.valor_ato_centavos, a.valor_ato_display,
          a.qtd_pre_chaves, a.qtd_pos_chaves ?? null, a.desconto_tipo, a.desconto_valor_centavos, a.desconto_percentual,
          a.desconto_display, a.previsao_entrega, a.campanha_vigente, a.vinculo_sousa_label,
        ],
      );
      if (!rowCount) { resumo.avaliacoesJaExistiam++; continue; }
      if (a.data_visita && !dataOuNull(a.data_visita)) {
        resumo.avisos.push(`${a.id}: data da visita "${a.data_visita}" fora do formato AAAA-MM-DD — ficou vazia.`);
      }
      importadas.push(a);
      resumo.avaliacoes++;
    }

    // Vínculo Sousa x Concorrente só depois que todas existem (chave para a própria tabela).
    for (const a of importadas) {
      if (a.vinculo_sousa_id) {
        await destino.query(`update co_avaliacoes set vinculo_sousa_id = $1 where id = $2`, [a.vinculo_sousa_id, a.id]);
      }
    }

    // ---- Pilares, jornada e gaps (só das avaliações importadas agora) ----
    const ids = importadas.map((a) => a.id);
    if (ids.length) {
      const { rows: pilares } = await origem.query(`select * from pilares where avaliacao_id = any($1)`, [ids]);
      for (const p of pilares) {
        await destino.query(
          `insert into co_pilares (avaliacao_id, pilar_key, avaliado, nota_informada, evidencia, nota_calibrada, justificativa_calibragem)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
          [p.avaliacao_id, p.pilar_key, p.avaliado, p.nota_informada, p.evidencia, p.nota_calibrada, p.justificativa_calibragem],
        );
      }
      const { rows: jornada } = await origem.query(`select * from jornada where avaliacao_id = any($1)`, [ids]);
      for (const j of jornada) {
        await destino.query(
          `insert into co_jornada (avaliacao_id, etapa_key, status, status_calibrado) values ($1,$2,$3,$4) on conflict do nothing`,
          [j.avaliacao_id, j.etapa_key, j.status, j.status_calibrado],
        );
      }
      const { rows: gaps } = await origem.query(`select * from gaps where avaliacao_id = any($1) order by id`, [ids]);
      for (const g of gaps) {
        await destino.query(
          `insert into co_gaps (avaliacao_id, gap, pilar_relacionado, evidencia, gravidade, criado_em) values ($1,$2,$3,$4,$5,$6)`,
          [g.avaliacao_id, g.gap, g.pilar_relacionado, g.evidencia ?? "", g.gravidade, g.created_at],
        );
        resumo.gaps++;
      }
    }

    // ---- Contador de IDs: nunca reutilizar um número do app antigo -------
    const { rows: contadores } = await origem.query(`select ano, proximo from id_counters`);
    for (const c of contadores) {
      await destino.query(
        `insert into co_id_contadores (ano, proximo) values ($1, $2)
         on conflict (ano) do update set proximo = greatest(co_id_contadores.proximo, excluded.proximo)`,
        [Number(c.ano), c.proximo],
      );
    }

    if (APLICAR) await destino.query("commit");
    else await destino.query("rollback");
  } catch (e) {
    await destino.query("rollback").catch(() => {});
    throw e;
  } finally {
    await origem.end();
    await destino.end();
  }

  console.log(APLICAR ? "[importar] Importação aplicada." : "[importar] SIMULAÇÃO — nada foi gravado. Use --aplicar para gravar.");
  console.log(`[importar] usuários novos: ${resumo.usuariosNovos}, usuários com perfil adicionado: ${resumo.usuariosComPerfilNovo}`);
  console.log(`[importar] avaliações importadas: ${resumo.avaliacoes} (já existiam: ${resumo.avaliacoesJaExistiam}), gaps: ${resumo.gaps}`);
  for (const a of resumo.avisos) console.log(`[importar] aviso: ${a}`);
}

main().catch((e) => {
  console.error("[importar] falhou:", e.message);
  process.exit(1);
});
