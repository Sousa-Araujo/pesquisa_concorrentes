-- Tabelas e espelhos: depois de aprovada, o administrador pode corrigir a data
-- de referência (mês), o estoque e as vendas da leitura. Cada correção fica
-- registrada aqui (quem, quando, valores antes e depois).
alter table leituras_tabela add column if not exists edicoes_admin jsonb not null default '[]';
