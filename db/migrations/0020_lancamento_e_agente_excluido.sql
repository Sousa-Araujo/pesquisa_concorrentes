-- Data de lançamento nos cadastros de empreendimentos e concorrentes.
alter table empreendimentos add column if not exists data_lancamento date;
alter table concorrentes add column if not exists data_lancamento date;

-- Exclusão de agente de campo sem perder as coletas: o cadastro fica
-- marcado como excluído (some da lista e não entra mais), o nome continua
-- nas coletas já feitas e o telefone/e-mail ficam livres para outro cadastro.
alter table agentes_campo add column if not exists excluido_em timestamptz;
alter table agentes_campo alter column telefone drop not null;
