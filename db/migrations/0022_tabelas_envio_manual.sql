-- Tabelas e espelhos: envio manual. O Supervisor de Parcerias pode informar
-- direto a quantidade em estoque e as vendas do mês, sem arquivo; a leitura
-- vai para a mesma conferência do Coordenador de Market Share.
alter table leituras_tabela add column if not exists origem text not null default 'arquivo';
alter table leituras_tabela drop constraint if exists chk_leitura_origem;
alter table leituras_tabela add constraint chk_leitura_origem check (origem in ('arquivo', 'manual'));
alter table leituras_tabela alter column arquivo drop not null;
alter table leituras_tabela alter column arquivo_nome drop not null;
alter table leituras_tabela alter column arquivo_mime drop not null;
alter table leituras_tabela drop constraint if exists chk_leitura_arquivo;
alter table leituras_tabela add constraint chk_leitura_arquivo check (origem = 'manual' or arquivo is not null);
