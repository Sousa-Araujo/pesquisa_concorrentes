-- Estoque dos empreendimentos Sousa vindo do CV passa a incluir as unidades
-- bloqueadas (disponíveis + reservadas + bloqueadas). Os meses já gravados com a
-- regra antiga (origem 'cv' e a coluna bloqueadas preenchida) somam as bloqueadas
-- uma única vez; o mês atual é regravado pela própria sincronização.
-- Meses estimados (preenchimento de meses antigos) e dados digitados à mão ficam como estão.
update dados_proprios_mensais
   set estoque = estoque + bloqueadas
 where origem = 'cv' and coalesce(estimado, false) = false
   and bloqueadas is not null and bloqueadas > 0
   and mes_ano < date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
