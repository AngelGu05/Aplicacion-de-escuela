-- =====================================================================
--  Aula de Ciencias — Agenda y Notas
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- Salones ----------------------------------------------------------------
create table if not exists public.classrooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,              -- ej. "10°A"
  created_at timestamptz not null default now()
);

-- Salón de cada alumno, permiso de editor y enlace privado del calendario ---
alter table public.profiles add column if not exists classroom_id uuid references public.classrooms (id) on delete set null;
alter table public.profiles add column if not exists can_edit_agenda boolean not null default false;
alter table public.profiles add column if not exists calendar_token uuid not null default gen_random_uuid();

-- Agenda ------------------------------------------------------------------
-- scope = 'salon'    → evento publicado para un salón (classroom_id) o para todos (classroom_id vacío)
-- scope = 'personal' → evento que un alumno agregó solo para sí mismo
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null check (scope in ('salon', 'personal')),
  classroom_id uuid references public.classrooms (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  kind         text not null default 'tarea' check (kind in ('examen', 'tarea', 'proyecto', 'actividad', 'otro')),
  subject      text,
  event_date   date not null,
  event_time   time,
  description  text,
  remind_days  int  not null default 1 check (remind_days between 0 and 14),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists events_date_idx on public.events (event_date);
create index if not exists events_owner_idx on public.events (owner_id);
create index if not exists events_classroom_idx on public.events (classroom_id);

-- Lo que cada alumno hace con los eventos de su salón (solo afecta su agenda)
create table if not exists public.event_status (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  done     boolean not null default false,
  hidden   boolean not null default false,
  primary key (user_id, event_id)
);

-- Notas (privadas: cada alumno solo ve las suyas) ---------------------------
create table if not exists public.grade_prefs (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  scale_min    numeric not null default 1,
  scale_max    numeric not null default 5,
  pass_mark    numeric not null default 3,
  decimals     int     not null default 1 check (decimals between 0 and 2),
  periods      int     not null default 3 check (periods between 1 and 6),
  period_label text    not null default 'Trimestre'
);

create table if not exists public.grade_subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  color      text not null default '#2563eb',
  target     numeric,                                   -- meta propia (si no, la nota para pasar)
  method     text not null default 'promedio' check (method in ('promedio', 'ponderado')),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists grade_subjects_user_idx on public.grade_subjects (user_id);

create table if not exists public.grade_categories (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.grade_subjects (id) on delete cascade,
  name       text not null,
  weight     numeric not null default 0,                -- porcentaje
  position   int not null default 0
);
create index if not exists grade_categories_subject_idx on public.grade_categories (subject_id);

create table if not exists public.grade_items (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.grade_subjects (id) on delete cascade,
  category_id uuid references public.grade_categories (id) on delete set null,
  period      int  not null default 1,
  name        text not null default '',
  score       numeric,                                  -- vacío = nota pendiente
  created_at  timestamptz not null default now()
);
create index if not exists grade_items_subject_idx on public.grade_items (subject_id, period);

-- Seguridad: nada accesible desde el navegador, solo desde el servidor -------
alter table public.classrooms       enable row level security;
alter table public.events           enable row level security;
alter table public.event_status     enable row level security;
alter table public.grade_prefs      enable row level security;
alter table public.grade_subjects   enable row level security;
alter table public.grade_categories enable row level security;
alter table public.grade_items      enable row level security;
revoke all on public.classrooms, public.events, public.event_status, public.grade_prefs, public.grade_subjects, public.grade_categories, public.grade_items from anon, authenticated;
