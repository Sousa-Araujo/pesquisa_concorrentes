-- Tabelas e espelhos: além do valor de tabela, o valor com desconto
-- (quando o documento traz os dois, ex.: "Valor de Venda com Desconto").
-- Os indicadores (maior, menor, ticket médio) passam a existir para os dois.

alter table leituras_tabela
  add column desconto_min_centavos bigint,
  add column desconto_max_centavos bigint,
  add column ticket_desconto_centavos bigint;

alter table precos_mensais
  add column desconto_min_centavos bigint,
  add column desconto_max_centavos bigint,
  add column ticket_desconto_centavos bigint;
