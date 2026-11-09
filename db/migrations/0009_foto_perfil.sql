-- =====================================================================
-- 0009_foto_perfil.sql
-- Foto do perfil escolhida pela própria pessoa no menu do usuário (navbar).
-- Guardada como data URL (JPEG reduzido no navegador para 160px), então
-- fica pequena e não precisa de serviço de arquivos.
-- =====================================================================

alter table usuarios add column if not exists foto text;
