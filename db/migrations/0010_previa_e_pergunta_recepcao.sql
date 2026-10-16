-- =====================================================================
-- 0010_previa_e_pergunta_recepcao.sql
-- Melhorias do Cliente Oculto:
--   - pergunta da recepção: a recepcionista perguntou como o cliente ficou
--     sabendo do empreendimento? (protocolo de registro da origem);
--   - atendimento prévio online: contatos feitos pelos canais online antes
--     da visita, com os horários de cada etapa (vira indicador de tempo de
--     atendimento no relatório). Pode existir sem a visita ("só prévia").
-- Datas e horários da prévia ficam como texto "AAAA-MM-DDTHH:MM" (horário
-- local informado pelo avaliador, sem fuso).
-- =====================================================================

alter table co_avaliacoes
  add column if not exists recepcao_perguntou_origem   text,
  add column if not exists somente_previa              boolean not null default false,
  add column if not exists previa_canal                text,
  add column if not exists previa_contato_em           text,
  add column if not exists previa_primeiro_retorno_em  text,
  add column if not exists previa_primeiro_retorno_por text,
  add column if not exists previa_segundo_contato_em   text,
  add column if not exists previa_agendamento_em       text,
  add column if not exists previa_observacoes          text;

alter table co_avaliacoes drop constraint if exists chk_co_pergunta_origem;
alter table co_avaliacoes add constraint chk_co_pergunta_origem
  check (recepcao_perguntou_origem is null or recepcao_perguntou_origem in ('sim', 'nao', 'na'));

alter table co_avaliacoes drop constraint if exists chk_co_previa_retorno_por;
alter table co_avaliacoes add constraint chk_co_previa_retorno_por
  check (previa_primeiro_retorno_por is null or previa_primeiro_retorno_por in ('ia', 'pessoa'));

alter table co_avaliacoes drop constraint if exists chk_co_previa_datas;
alter table co_avaliacoes add constraint chk_co_previa_datas check (
  (previa_contato_em is null or previa_contato_em ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$') and
  (previa_primeiro_retorno_em is null or previa_primeiro_retorno_em ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$') and
  (previa_segundo_contato_em is null or previa_segundo_contato_em ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$') and
  (previa_agendamento_em is null or previa_agendamento_em ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$')
);
