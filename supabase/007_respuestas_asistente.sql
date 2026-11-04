-- =====================================================================
--  Aula de Ciencias — Respuestas que el administrador le enseña al asistente
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

create table if not exists public.assistant_answers (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,                 -- pregunta de ejemplo
  keywords     text not null default '',      -- palabras clave separadas por coma
  answer       text not null,                 -- lo que responde el asistente
  classroom_id uuid references public.classrooms (id) on delete cascade,  -- vacío = para todos
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.assistant_answers enable row level security;
revoke all on public.assistant_answers from anon, authenticated;
