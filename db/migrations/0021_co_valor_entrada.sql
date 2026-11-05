-- Cliente Oculto: "Valor de entrada" nas condições comerciais da visita
-- (ao lado do valor da unidade e do valor do ato).
alter table co_avaliacoes add column if not exists valor_entrada_centavos bigint;
alter table co_avaliacoes add column if not exists valor_entrada_display text;
