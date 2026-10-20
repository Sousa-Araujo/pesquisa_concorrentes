-- =====================================================================
-- 0017_recibo_aprovacao.sql
-- Aprovação do recibo pelo Coordenador de Market Share antes do pagamento:
-- assinado → aprovado → pago. O coordenador também pode devolver o recibo
-- para correção (apaga a assinatura e guarda o motivo, que o avaliador vê).
-- Recibos já pagos contam como aprovados.
-- =====================================================================

alter table co_recibos_avaliador
  add column if not exists aprovado_em      timestamptz,
  add column if not exists aprovado_por     uuid references usuarios (id_usuario),
  add column if not exists devolvido_em     timestamptz,
  add column if not exists devolvido_motivo text;

update co_recibos_avaliador set aprovado_em = pago_em, aprovado_por = pago_por
 where pago_em is not null and aprovado_em is null;
