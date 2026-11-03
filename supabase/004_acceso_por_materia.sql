-- =====================================================================
--  Aula de Ciencias — Acceso Premium por materia
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- Qué materias Premium puede ver cada alumno (una fila por alumno y materia).
create table if not exists public.subject_access (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  expires_at date,                         -- vacío = sin vencimiento; si tiene fecha, sirve hasta ese día incluido
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

-- Quien ya tenía "Premium" (el sistema anterior) recibe acceso a TODAS las materias.
insert into public.subject_access (user_id, subject_id)
select p.id, s.id
from public.profiles p cross join public.subjects s
where p.premium and p.role = 'student'
on conflict do nothing;

alter table public.subject_access enable row level security;
revoke all on public.subject_access from anon, authenticated;
