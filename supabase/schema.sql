-- =====================================================================
--  Aula de Ciencias — esquema de la base de datos
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- Materias -------------------------------------------------------------
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  color       text not null default '#2563eb',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Perfiles (uno por cuenta de alumno o administrador) -------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text,
  role              text not null default 'student' check (role in ('admin', 'student')),
  premium           boolean not null default false,   -- acceso a lecciones Premium
  disabled          boolean not null default false,   -- cuenta suspendida
  active_session_id uuid,                             -- la ÚNICA sesión válida
  last_login_at     timestamptz,
  created_at        timestamptz not null default now()
);

-- Lecciones y avisos ----------------------------------------------------
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  title       text not null,
  description text,
  kind        text not null default 'interactiva' check (kind in ('interactiva', 'aviso')),
  content     text not null default '',
  is_premium  boolean not null default false,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lessons_subject_idx on public.lessons (subject_id, created_at desc);

-- Registro de accesos ---------------------------------------------------
create table if not exists public.access_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete set null,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists access_logs_created_idx on public.access_logs (created_at desc);
create index if not exists access_logs_user_idx on public.access_logs (user_id, created_at desc);

-- Seguridad -------------------------------------------------------------
-- Nadie puede leer ni escribir estas tablas desde el navegador.
-- Solo el servidor de la página (con la Secret key) tiene acceso.
alter table public.subjects    enable row level security;
alter table public.profiles    enable row level security;
alter table public.lessons     enable row level security;
alter table public.access_logs enable row level security;

revoke all on public.subjects, public.profiles, public.lessons, public.access_logs from anon, authenticated;

-- Materias iniciales ----------------------------------------------------
insert into public.subjects (slug, name, description, color, position) values
  ('fisica',   'Física',   'Movimiento, fuerzas, energía y más.',        '#2563eb', 1),
  ('quimica',  'Química',  'Materia, reacciones y nomenclatura.',        '#d97706', 2),
  ('biologia', 'Biología', 'La vida, las células y el ADN.',             '#059669', 3)
on conflict (slug) do nothing;
