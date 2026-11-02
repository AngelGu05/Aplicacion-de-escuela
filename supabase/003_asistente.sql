-- =====================================================================
--  Aula de Ciencias — Asistente
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- Preguntas que el asistente no entendió (SIN guardar quién las hizo).
-- Sirven para saber qué enseñarle.
create table if not exists public.assistant_unknown (
  id         uuid primary key default gen_random_uuid(),
  normalized text not null unique,   -- la pregunta "limpia", para agrupar repetidas
  example    text not null,          -- cómo la escribió alguien (sin nombre)
  count      int  not null default 1,
  last_at    timestamptz not null default now()
);
create index if not exists assistant_unknown_count_idx on public.assistant_unknown (count desc, last_at desc);

alter table public.assistant_unknown enable row level security;
revoke all on public.assistant_unknown from anon, authenticated;
