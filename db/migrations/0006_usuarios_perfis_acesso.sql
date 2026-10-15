-- =====================================================================
-- 0006_usuarios_perfis_acesso.sql
-- Base do sistema unificado de Market Share (Pesquisa de Concorrentes +
-- Cliente Oculto): um cadastro único de usuários com perfis, login sem
-- senha por código enviado ao e-mail (ou SMS/e-mail para o agente de
-- campo) e sessões guardadas no banco (revogáveis na hora).
--
-- `gestores` vira `usuarios`: as chaves estrangeiras existentes
-- (created_by, updated_by, atualizado_por, excluido_por) acompanham o
-- rename automaticamente. Os gestores atuais recebem o perfil `admin`,
-- equivalente ao acesso total que já tinham na Pesquisa.
-- =====================================================================

alter table gestores rename to usuarios;
alter table usuarios rename column id_gestor to id_usuario;
alter index if exists uq_gestores_email_lower rename to uq_usuarios_email_lower;
alter trigger trg_gestores_updated on usuarios rename to trg_usuarios_updated;

-- Perfil único fixo ('gestor') dá lugar a uma lista de perfis por pessoa.
alter table usuarios drop column perfil;
alter table usuarios add column perfis text[] not null default '{}';
update usuarios set perfis = '{admin}';
alter table usuarios add constraint chk_usuarios_perfis check (
  cardinality(perfis) > 0
  and perfis <@ array[
    'admin',
    'coordenador_produto',
    'supervisor_parcerias',
    'coordenador_market_share',
    'avaliador',
    'diretoria'
  ]::text[]
);

-- Login passa a ser só por código: a senha deixa de ser obrigatória
-- (a coluna fica por enquanto para não perder dados; não é mais lida).
alter table usuarios alter column senha_hash drop not null;

alter table usuarios
  -- Acesso temporário (ex.: avaliador contratado para uma visita):
  -- passado este instante, o login e as sessões deixam de valer.
  add column if not exists acesso_expira_em timestamptz,
  add column if not exists ultimo_acesso_em timestamptz,
  -- Convite por e-mail: o link leva o token; só o hash fica no banco.
  -- O token apenas preenche o e-mail na tela de entrada — sozinho não
  -- dá acesso (quem entra é quem recebe o código naquela caixa).
  add column if not exists convite_token_hash text,
  add column if not exists convite_enviado_em timestamptz;
create unique index if not exists uq_usuarios_convite_token
  on usuarios (convite_token_hash) where convite_token_hash is not null;

-- Agente de campo: e-mail opcional, usado para enviar o código quando
-- não houver SMS configurado.
alter table agentes_campo add column if not exists email text;
create unique index if not exists uq_agentes_email_lower
  on agentes_campo (lower(email)) where email is not null;

-- ---------------------------------------------------------------------
-- SESSOES — uma linha por login. Guarda só o hash do token do cookie.
-- Pertence a um usuário OU a um agente de campo.
-- ---------------------------------------------------------------------
create table if not exists sessoes (
  token_hash  text primary key,
  id_usuario  uuid references usuarios (id_usuario) on delete cascade,
  id_agente   uuid references agentes_campo (id_agente) on delete cascade,
  criada_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  constraint chk_sessao_dono check ((id_usuario is null) <> (id_agente is null))
);
create index if not exists idx_sessoes_usuario on sessoes (id_usuario);
create index if not exists idx_sessoes_agente  on sessoes (id_agente);
create index if not exists idx_sessoes_expira  on sessoes (expira_em);

-- ---------------------------------------------------------------------
-- CODIGOS_ACESSO — código de 6 dígitos, uso único, validade curta.
-- Só o HMAC do código é guardado. `tentativas` limita chutes.
-- ---------------------------------------------------------------------
create table if not exists codigos_acesso (
  id_codigo    uuid primary key default gen_random_uuid(),
  id_usuario   uuid references usuarios (id_usuario) on delete cascade,
  id_agente    uuid references agentes_campo (id_agente) on delete cascade,
  canal        text not null check (canal in ('email', 'sms')),
  destino      text not null,
  codigo_hash  text not null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  tentativas   integer not null default 0,
  usado_em     timestamptz,
  constraint chk_codigo_dono check ((id_usuario is null) <> (id_agente is null))
);
create index if not exists idx_codigos_usuario on codigos_acesso (id_usuario, criado_em desc);
create index if not exists idx_codigos_agente  on codigos_acesso (id_agente, criado_em desc);
