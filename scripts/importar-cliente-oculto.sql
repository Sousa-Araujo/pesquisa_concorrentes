-- Importa o Cliente Oculto antigo (banco "co_legado", restaurado no mesmo
-- servidor Postgres) para as tabelas co_* do sistema unificado, sem acesso
-- externo: os dois bancos se enxergam pelo postgres_fdw, dentro do servidor.
-- Mesma regra de scripts/importar-cliente-oculto.mjs.
--
--   psql -U postgres -d railway -v aplicar=0 -f importar-cliente-oculto.sql   -> simulação (desfaz no fim)
--   psql -U postgres -d railway -v aplicar=1 -f importar-cliente-oculto.sql   -> grava
--
-- Avaliações antigas entram no formato antigo (modelo_criterios = 1) e sem
-- avaliador dono; o que já existir (mesmo id) é pulado.
\set ON_ERROR_STOP on

create extension if not exists postgres_fdw;
drop server if exists co_legado_srv cascade;
create server co_legado_srv foreign data wrapper postgres_fdw options (dbname 'co_legado');
create user mapping for current_user server co_legado_srv options (user 'postgres', password_required 'false');
drop schema if exists legado cascade;
create schema legado;
import foreign schema public limit to (usuarios, avaliacoes, pilares, jornada, gaps, id_counters)
  from server co_legado_srv into legado;

begin;

create temp table _resumo (item text, n int);

-- ---- Usuários: casados pelo e-mail; papel antigo → perfil novo --------------
create temp table _u as
select distinct on (lower(trim(email))) nome, lower(trim(email)) as email, ativo,
       case papel when 'avaliador' then 'avaliador' when 'coordenador' then 'coordenador_market_share' when 'admin' then 'admin' end as perfil
  from legado.usuarios order by lower(trim(email)), id;

with novos as (
  insert into usuarios (nome, email, perfis, ativo)
  select u.nome, u.email, array[u.perfil], u.ativo from _u u
   where u.perfil is not null and not exists (select 1 from usuarios x where lower(x.email) = u.email)
  returning 1)
insert into _resumo select 'usuários novos', count(*) from novos;

with perfil as (
  update usuarios x set perfis = array_append(x.perfis, u.perfil)
    from _u u
   where lower(x.email) = u.email and u.perfil is not null and not (u.perfil = any(x.perfis))
  returning 1)
insert into _resumo select 'usuários com perfil adicionado', count(*) from perfil;

-- ---- Avaliações ------------------------------------------------------------
create temp table _novas as
select a.* from legado.avaliacoes a where not exists (select 1 from co_avaliacoes c where c.id = a.id);

insert into co_avaliacoes (
  id, status, criada_em, atualizada_em, finalizada_em, concluida_em, calibragem_aberta, excluida, excluida_em,
  tipo_empreendimento, empreendimento_texto, construtora_texto, regional, data_visita, horario,
  cliente_oculto_nome, recepcionista, corretor, area_unidade_m2, area_unidade_display,
  valor_unidade_centavos, valor_unidade_display, valor_ato_centavos, valor_ato_display,
  qtd_pre_chaves, qtd_pos_chaves, desconto_tipo, desconto_valor_centavos, desconto_percentual,
  desconto_display, previsao_entrega, campanha_vigente, vinculo_sousa_label, modelo_criterios)
select id, status, created_at, updated_at, finalized_at, concluded_at, calibragem_aberta, excluida, excluida_em,
  coalesce(tipo_empreendimento, 'sousa'), empreendimento, construtora, regional,
  case when data_visita ~ '^\d{4}-\d{2}-\d{2}$' then data_visita::date end, horario,
  cliente_oculto, recepcionista, corretor, area_unidade_m2, area_unidade_display,
  valor_unidade_centavos, valor_unidade_display, valor_ato_centavos, valor_ato_display,
  qtd_pre_chaves, qtd_pos_chaves, desconto_tipo, desconto_valor_centavos, desconto_percentual,
  desconto_display, previsao_entrega, campanha_vigente, vinculo_sousa_label, 1
  from _novas order by created_at;
insert into _resumo select 'avaliações importadas', count(*) from _novas;
insert into _resumo select 'avaliações que já existiam', count(*) from legado.avaliacoes a
  where not exists (select 1 from _novas n where n.id = a.id);
insert into _resumo select 'avaliações com data fora do formato (ficou vazia)', count(*) from _novas
  where data_visita is not null and data_visita <> '' and data_visita !~ '^\d{4}-\d{2}-\d{2}$';

-- Vínculo Sousa x Concorrente só depois que todas existem.
update co_avaliacoes c set vinculo_sousa_id = n.vinculo_sousa_id
  from _novas n where c.id = n.id and n.vinculo_sousa_id is not null;

-- ---- Pilares, jornada e gaps (só das avaliações importadas agora) ----------
insert into co_pilares (avaliacao_id, pilar_key, avaliado, nota_informada, evidencia, nota_calibrada, justificativa_calibragem)
select p.avaliacao_id, p.pilar_key, p.avaliado, p.nota_informada, p.evidencia, p.nota_calibrada, p.justificativa_calibragem
  from legado.pilares p join _novas n on n.id = p.avaliacao_id
on conflict do nothing;
insert into _resumo select 'pilares', count(*) from co_pilares p join _novas n on n.id = p.avaliacao_id;

insert into co_jornada (avaliacao_id, etapa_key, status, status_calibrado)
select j.avaliacao_id, j.etapa_key, j.status, j.status_calibrado
  from legado.jornada j join _novas n on n.id = j.avaliacao_id
on conflict do nothing;
insert into _resumo select 'etapas da jornada', count(*) from co_jornada j join _novas n on n.id = j.avaliacao_id;

insert into co_gaps (avaliacao_id, gap, pilar_relacionado, evidencia, gravidade, criado_em)
select g.avaliacao_id, g.gap, g.pilar_relacionado, coalesce(g.evidencia, ''), g.gravidade, g.created_at
  from legado.gaps g join _novas n on n.id = g.avaliacao_id order by g.id;
insert into _resumo select 'gaps', count(*) from co_gaps g join _novas n on n.id = g.avaliacao_id;

-- ---- Contador de IDs: nunca reutilizar um número do app antigo -------------
insert into co_id_contadores (ano, proximo)
select ano::int, proximo from legado.id_counters
on conflict (ano) do update set proximo = greatest(co_id_contadores.proximo, excluded.proximo);

select item, n from _resumo;
select 'aviso: ' || u.email || ' (' || u.perfil || ') não é @sousaaraujo.com.br' as aviso
  from _u u where u.perfil in ('coordenador_market_share', 'admin') and u.email not like '%@sousaaraujo.com.br';
select 'aviso: papel desconhecido para ' || email as aviso from _u where perfil is null;

\if :aplicar
  commit;
  \echo '[importar] Importação aplicada.'
\else
  rollback;
  \echo '[importar] SIMULAÇÃO — nada foi gravado.'
\endif

drop schema legado cascade;
drop server co_legado_srv cascade;
