-- =====================================================================
-- 0013_recibo_modelo_oficial.sql
-- Recibo do Cliente Oculto no modelo oficial da Sousa Araujo: telefone,
-- quantidade de pesquisas realizadas e valor unitário por pesquisa. O valor
-- total (valor_centavos) passa a ser quantidade x valor unitário, calculado
-- pelo sistema. A cidade deixa de ser pedida (a coluna fica para os
-- recibos já feitos).
-- =====================================================================

alter table co_recibos
  add column if not exists telefone                text,
  add column if not exists quantidade_pesquisas    integer check (quantidade_pesquisas is null or quantidade_pesquisas > 0),
  add column if not exists valor_unitario_centavos bigint check (valor_unitario_centavos is null or valor_unitario_centavos > 0);
