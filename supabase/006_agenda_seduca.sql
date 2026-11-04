-- =====================================================================
--  Aula de Ciencias — Agenda importada desde Seduca
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- source = 'seduca' para los eventos que vinieron de Seduca (los demás quedan vacíos).
-- external_id identifica el evento de Seduca para actualizarlo sin duplicar al volver a importar.
alter table public.events add column if not exists source text;
alter table public.events add column if not exists external_id text;
create index if not exists events_external_idx on public.events (external_id);
