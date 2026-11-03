-- =====================================================================
--  Aula de Ciencias — Cuentas "Solo herramientas"
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- true  = ve las materias y lecciones (como hasta ahora)
-- false = "Solo herramientas": agenda, notas y asistente, sin ninguna lección
alter table public.profiles add column if not exists lessons_enabled boolean not null default true;
