-- =====================================================================
-- 0011_recibo_cliente_oculto.sql
-- Recibo de pagamento do Cliente Oculto (avaliador): a pessoa informa os
-- dados para o PIX e o valor, assina na tela, e o Coordenador de Market
-- Share marca como pago. Um recibo por avaliação.
-- A assinatura fica como imagem PNG (data URL). Mudar qualquer dado depois
-- de assinado apaga a assinatura: o recibo precisa ser assinado de novo.
-- =====================================================================

create table if not exists co_recibos (
  avaliacao_id    text primary key references co_avaliacoes (id) on delete cascade,
  nome_completo   text,
  cpf             text check (cpf is null or cpf ~ '^\d{11}$'),
  chave_pix_tipo  text check (chave_pix_tipo is null or chave_pix_tipo in ('cpf', 'celular', 'email', 'aleatoria')),
  chave_pix       text,
  valor_centavos  bigint check (valor_centavos is null or valor_centavos > 0),
  cidade          text,
  assinatura      text,
  assinado_em     timestamptz,
  pago_em         timestamptz,
  pago_por        uuid references usuarios (id_usuario),
  atualizado_em   timestamptz not null default now()
);
