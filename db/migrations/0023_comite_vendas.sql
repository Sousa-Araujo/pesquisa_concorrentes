-- =====================================================================
-- 0023_comite_vendas.sql
-- Comitê de vendas (só administrador, em Tabelas e espelhos): o PDF mensal
-- do comitê é lido por IA, o administrador confere e, aprovado, as
-- condições de cada empreendimento Sousa alimentam o Quadro Comparativo
-- (desconto %, parcelas pré-chaves, parcelas pós-chaves, prazo até a
-- entrega e entrega). Mesmo modelo do GDP: a vigência é informada à mão no
-- envio (não é lida do PDF) e um novo envio com a mesma vigência substitui
-- o anterior.
-- =====================================================================

create table if not exists comites_vendas (
  id                uuid primary key default gen_random_uuid(),
  vigencia_inicio   date not null,
  vigencia_fim      date not null,
  arquivo_nome      text not null,
  arquivo_mime      text not null,
  arquivo           bytea not null,
  enviado_por       uuid references usuarios (id_usuario),
  enviado_em        timestamptz not null default now(),
  status            text not null default 'lendo'
                      check (status in ('lendo', 'para_conferir', 'aprovado', 'recusado')),
  erro_ia           text,
  modelo_ia         text,
  observacoes_ia    text,
  -- Linhas lidas pela IA e conferidas (uma por produto do PDF).
  linhas            jsonb not null default '[]',
  conferido_por     uuid references usuarios (id_usuario),
  conferido_em      timestamptz,
  motivo_recusa     text,
  constraint chk_comite_vigencia check (vigencia_fim >= vigencia_inicio)
);
create index if not exists idx_comites_status on comites_vendas (status);
create index if not exists idx_comites_vigencia on comites_vendas (vigencia_inicio, vigencia_fim);

-- Condições aprovadas, uma linha por empreendimento Sousa de cada comitê.
create table if not exists comite_condicoes (
  id_comite                  uuid not null references comites_vendas (id) on delete cascade,
  id_empreendimento          integer not null references empreendimentos (id_empreendimento),
  produto                    text not null,
  regional                   text,
  previsao_entrega           text,
  entrega                    date check (entrega is null or date_trunc('month', entrega) = entrega),
  parcelas_pre               integer,
  parcelas_pos               integer,
  pos_percentual             numeric(5, 2),
  desconto_financiado_pct    numeric(5, 2),
  desconto_financiado_obs    text,
  desconto_avista_pct        numeric(5, 2),
  desconto_avista_obs        text,
  primary key (id_comite, id_empreendimento)
);
create index if not exists idx_comite_condicoes_emp on comite_condicoes (id_empreendimento);

-- Como o produto aparece no PDF do comitê → empreendimento do cadastro
-- (os nomes diferem: "SAFIRA M2" x "Residencial Safira II"). Aprendido na
-- conferência, para o mês seguinte já vir ligado. chave_pdf é o nome sem
-- acento/prefixos e com a etapa em romano (chaveEmpreendimento).
create table if not exists comite_apelidos (
  chave_pdf          text primary key,
  nome_pdf           text not null,
  id_empreendimento  integer not null references empreendimentos (id_empreendimento),
  criado_em          timestamptz not null default now()
);
