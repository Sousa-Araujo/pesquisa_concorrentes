-- =====================================================================
-- 0016_recibo_por_avaliador.sql
-- Recibo do Cliente Oculto passa a ser UM por avaliador, com todas as
-- visitas enviadas que ainda não estão em recibo assinado. Cada visita tem
-- o seu valor (digitado pelo avaliador); o total é a soma. Depois de
-- assinado, as próximas visitas vão para um novo recibo.
-- Os recibos antigos (um por avaliação) já assinados ou pagos viram
-- recibos com uma visita só. Os não assinados não são migrados: as visitas
-- deles entram no recibo aberto do avaliador. A tabela co_recibos fica
-- como histórico.
-- =====================================================================

create table if not exists co_recibos_avaliador (
  id              uuid primary key default gen_random_uuid(),
  avaliador_id    uuid not null references usuarios (id_usuario),
  nome_completo   text,
  telefone        text,
  cpf             text check (cpf is null or cpf ~ '^\d{11}$'),
  chave_pix_tipo  text check (chave_pix_tipo is null or chave_pix_tipo in ('cpf', 'celular', 'email', 'aleatoria')),
  chave_pix       text,
  assinatura      text,
  assinado_em     timestamptz,
  pago_em         timestamptz,
  pago_por        uuid references usuarios (id_usuario),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists idx_co_recibos_avaliador on co_recibos_avaliador (avaliador_id);

create table if not exists co_recibo_visitas (
  recibo_id       uuid not null references co_recibos_avaliador (id) on delete cascade,
  avaliacao_id    text not null unique references co_avaliacoes (id) on delete cascade,
  valor_centavos  bigint check (valor_centavos is null or valor_centavos > 0),
  primary key (recibo_id, avaliacao_id)
);

-- Recibos antigos assinados ou pagos: um recibo novo com a visita e o valor total dela.
create temp table _recibos_antigos on commit drop as
  select gen_random_uuid() as novo_id, r.*, a.avaliador_id
    from co_recibos r
    join co_avaliacoes a on a.id = r.avaliacao_id
   where a.avaliador_id is not null
     and r.assinado_em is not null
     and not exists (select 1 from co_recibo_visitas v where v.avaliacao_id = r.avaliacao_id);

insert into co_recibos_avaliador (id, avaliador_id, nome_completo, telefone, cpf, chave_pix_tipo, chave_pix,
                                  assinatura, assinado_em, pago_em, pago_por, criado_em, atualizado_em)
select novo_id, avaliador_id, nome_completo, telefone, cpf, chave_pix_tipo, chave_pix,
       assinatura, assinado_em, pago_em, pago_por, coalesce(assinado_em, atualizado_em), atualizado_em
  from _recibos_antigos;

insert into co_recibo_visitas (recibo_id, avaliacao_id, valor_centavos)
select novo_id, avaliacao_id, valor_centavos from _recibos_antigos;
