-- =====================================================================
-- 0014_tabelas_espelhos.sql
-- Módulo Tabelas e espelhos: o Supervisor de Parcerias sobe o PDF da
-- tabela ou o print do espelho de vendas de um concorrente; a IA (Gemini)
-- lê unidade por unidade; o Coordenador de Market Share (ou o
-- administrador) confere e aprova. Na aprovação:
--   - estoque e vendas vão para coletas_mensais (origem 'tabela'),
--     substituindo a coleta do agente do mesmo mês (que fica guardada na
--     leitura, em coleta_substituida);
--   - preços (maior, menor, ticket médio) vão para precos_mensais.
-- Reservadas contam como estoque.
-- =====================================================================

alter table coletas_mensais alter column id_agente drop not null;
alter table coletas_mensais add column if not exists origem text not null default 'agente';
alter table coletas_mensais drop constraint if exists chk_coleta_origem;
alter table coletas_mensais add constraint chk_coleta_origem check (
  (origem = 'agente' and id_agente is not null) or origem = 'tabela'
);

create table if not exists leituras_tabela (
  id                     uuid primary key default gen_random_uuid(),
  id_concorrente         integer not null references concorrentes (id_concorrente),
  mes_ano                date not null check (date_trunc('month', mes_ano) = mes_ano),
  arquivo_nome           text not null,
  arquivo_mime           text not null,
  arquivo                bytea not null,
  enviado_por            uuid references usuarios (id_usuario),
  enviado_em             timestamptz not null default now(),
  status                 text not null default 'lendo'
                           check (status in ('lendo', 'para_conferir', 'aprovada', 'recusada')),
  erro_ia                text,
  modelo_ia              text,
  unidades               jsonb not null default '[]',
  observacoes_ia         text,
  -- Números (calculados das unidades e conferidos)
  total_unidades         integer,
  estoque                integer,
  reservadas             integer,
  vendidas_total         integer,
  vendas_mes             integer,
  vendas_metodo          text,
  valor_min_centavos     bigint,
  valor_max_centavos     bigint,
  ticket_medio_centavos  bigint,
  unidade_min            text,
  unidade_max            text,
  -- Conferência
  conferido_por          uuid references usuarios (id_usuario),
  conferido_em           timestamptz,
  motivo_recusa          text,
  coleta_substituida     jsonb
);
create index if not exists idx_leituras_concorrente_mes on leituras_tabela (id_concorrente, mes_ano);
create index if not exists idx_leituras_status on leituras_tabela (status);

alter table coletas_mensais add column if not exists id_leitura uuid references leituras_tabela (id);

create table if not exists precos_mensais (
  id_concorrente         integer not null references concorrentes (id_concorrente),
  mes_ano                date not null check (date_trunc('month', mes_ano) = mes_ano),
  valor_min_centavos     bigint,
  valor_max_centavos     bigint,
  ticket_medio_centavos  bigint,
  unidade_min            text,
  unidade_max            text,
  id_leitura             uuid references leituras_tabela (id),
  atualizado_em          timestamptz not null default now(),
  primary key (id_concorrente, mes_ano)
);
