-- =====================================================================
-- 0008_cliente_oculto_ajustes.sql
-- Ajustes para rodar as telas atuais do Cliente Oculto dentro do sistema
-- unificado sem mudar a aparência:
--   - volta os campos "display" (texto exatamente como o avaliador
--     digitou, ex.: "R$ 359.400,00", "62 m²"), que as telas mostram e
--     editam;
--   - remove a trava que exigia construtora/concorrente já no momento em
--     que a avaliação vira "concorrente" (o avaliador marca o tipo antes de
--     preencher a construtora);
--   - rótulo do vínculo Sousa x concorrente, mostrado no autocomplete.
-- =====================================================================

alter table co_avaliacoes
  add column if not exists area_unidade_display  text,
  add column if not exists valor_unidade_display text,
  add column if not exists valor_ato_display     text,
  add column if not exists desconto_display      text;

alter table co_avaliacoes drop constraint if exists chk_co_concorrente_ligado;

-- Rótulo do vínculo Sousa (texto mostrado no autocomplete), como no app antigo.
alter table co_avaliacoes add column if not exists vinculo_sousa_label text;
