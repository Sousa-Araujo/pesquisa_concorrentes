-- Usuário SÓ DE LEITURA para o sistema de Market Share ler o BI do CV.
-- Para a TI rodar no banco do CV (RDS cvcrm-db), conectado como administrador.
-- Substitua <SENHA_FORTE> por uma senha gerada (32+ caracteres) e guarde-a só
-- no Railway, na variável CV_DATABASE_URL dos serviços do Market Share.
--
-- O sistema lê apenas estas 4 visões do schema bi_mcp_comercial:
--   dim_empreendimento, kpi_estoque_por_empreendimento,
--   kpi_ticket_tabela_vigente, fato_venda
-- Este usuário não enxerga nenhuma outra tabela (leads, clientes, pessoas...).

create role market_share_leitura
  login
  password '<SENHA_FORTE>'
  nosuperuser nocreatedb nocreaterole noinherit noreplication
  connection limit 5;

-- Somente leitura e tempo máximo por consulta, mesmo que o sistema esqueça de pedir.
alter role market_share_leitura set default_transaction_read_only = on;
alter role market_share_leitura set statement_timeout = '180s';
alter role market_share_leitura set idle_in_transaction_session_timeout = '60s';

-- Acesso só ao banco e ao schema do BI.
grant connect on database postgres to market_share_leitura;
revoke all on schema public from market_share_leitura;
grant usage on schema bi_mcp_comercial to market_share_leitura;

-- Só as 4 visões usadas (não "all tables"): se o BI ganhar uma visão nova com
-- dados pessoais, ela não fica visível sem um grant explícito.
grant select on
  bi_mcp_comercial.dim_empreendimento,
  bi_mcp_comercial.kpi_estoque_por_empreendimento,
  bi_mcp_comercial.kpi_ticket_tabela_vigente,
  bi_mcp_comercial.fato_venda
to market_share_leitura;

-- Conferência (deve listar só as 4 visões, todas com SELECT):
-- select table_schema, table_name, privilege_type
--   from information_schema.role_table_grants where grantee = 'market_share_leitura';
--
-- Depois de trocar o CV_DATABASE_URL no Railway (teste e produção nova) e
-- confirmar que a sincronização funcionou em "Dados do CV", o Market Share
-- deixa de usar o usuário postgres. Se algum dia precisar desfazer:
--   drop owned by market_share_leitura; drop role market_share_leitura;
