-- Concorrentes: link do Google Maps com a localização do empreendimento,
-- mostrado nos cards "Estoque e velocidade de vendas" do Quadro Comparativo.
alter table concorrentes add column if not exists link_maps text;
