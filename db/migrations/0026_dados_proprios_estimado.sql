-- Dados do CV › Preencher meses anteriores: o BI do CV só guarda a foto de hoje
-- do estoque, então o estoque de um mês que já fechou é uma estimativa
-- (estoque de hoje + vendas feitas depois do mês). A linha fica marcada.
alter table dados_proprios_mensais add column if not exists estimado boolean not null default false;
