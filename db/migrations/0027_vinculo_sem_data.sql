-- "Empreendimento Sousa comparado": o rótulo do vínculo mostra só o nome do
-- empreendimento, sem a data da visita ("SOU VIVER ROMA — 2026-05-08" vira
-- "SOU VIVER ROMA"). Limpa os rótulos já gravados; o vínculo (id) não muda.
update co_avaliacoes
   set vinculo_sousa_label = regexp_replace(vinculo_sousa_label, '\s+[—-]\s+(\d{4}-\d{2}-\d{2}|s/ data)\s*$', '')
 where vinculo_sousa_label ~ '\s+[—-]\s+(\d{4}-\d{2}-\d{2}|s/ data)\s*$';
