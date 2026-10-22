-- Cliente Oculto: formulário por critérios (4 por pilar, nota 0–10 + evidência).
-- Avaliações já existentes ficam no modelo 1 (nota única por pilar);
-- as novas nascem no modelo 2.
alter table co_avaliacoes add column if not exists modelo_criterios smallint not null default 1;
alter table co_avaliacoes alter column modelo_criterios set default 2;
alter table co_avaliacoes add column if not exists observacoes_gerais text;

-- Respostas por critério: { "1.1": { "nota": 8, "na": false, "evidencia": "..." }, ... }
alter table co_pilares add column if not exists criterios jsonb;
