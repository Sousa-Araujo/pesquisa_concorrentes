-- =====================================================================
-- 0018_dados_sousa_cv.sql
-- Dados dos empreendimentos Sousa vindos do BI comercial do CV (schema
-- bi_mcp_comercial, variável CV_DATABASE_URL), gravados pelo sistema na
-- mesma tabela dos "Dados próprios":
--  - empreendimentos.id_cv: ligação com o empreendimento do CV (pelo nome,
--    automático, ou escolhida à mão pelo administrador);
--  - dados_proprios_mensais ganha origem ('manual' | 'cv'), reservadas,
--    bloqueadas e os tickets (tabela do estoque e com desconto das vendas).
-- Regras combinadas: estoque = disponível + reservada; foto do mês = o
-- último retrato antes da virada do mês; dados digitados nunca são
-- sobrescritos.
-- =====================================================================

alter table empreendimentos
  add column if not exists id_cv integer,
  add column if not exists id_cv_manual boolean not null default false;

alter table dados_proprios_mensais
  add column if not exists origem text not null default 'manual' check (origem in ('manual', 'cv')),
  add column if not exists reservadas integer check (reservadas is null or reservadas >= 0),
  add column if not exists bloqueadas integer check (bloqueadas is null or bloqueadas >= 0),
  add column if not exists ticket_tabela_centavos bigint check (ticket_tabela_centavos is null or ticket_tabela_centavos > 0),
  add column if not exists ticket_desconto_centavos bigint check (ticket_desconto_centavos is null or ticket_desconto_centavos > 0),
  add column if not exists desconto_pct numeric;

-- Situação da última sincronização com o CV (uma linha só).
create table if not exists cv_sincronizacao (
  id            integer primary key default 1 check (id = 1),
  ultima_em     timestamptz,
  ok            boolean,
  mensagem      text
);
insert into cv_sincronizacao (id) values (1) on conflict do nothing;
