export type Role = "admin" | "student";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  premium: boolean;
  disabled: boolean;
  active_session_id: string | null;
  last_login_at: string | null;
  created_at: string;
  classroom_id: string | null;
  can_edit_agenda: boolean;
  calendar_token: string;
  lessons_enabled?: boolean; // false = cuenta "Solo herramientas" (sin lecciones)
};

export type Subject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
};

export type LessonKind = "interactiva" | "aviso";

export type Lesson = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  kind: LessonKind;
  content: string;
  is_premium: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
};

/** Lección sin el contenido (para listados). */
export type LessonSummary = Omit<Lesson, "content">;
export const LESSON_SUMMARY_COLUMNS =
  "id, subject_id, title, description, kind, is_premium, published, created_at, updated_at";

// ---------------------------------------------------------------- Agenda

export type Classroom = { id: string; name: string };

export type EventKind = "examen" | "tarea" | "proyecto" | "actividad" | "otro";
export type EventScope = "salon" | "personal";

export type AgendaEvent = {
  id: string;
  scope: EventScope;
  classroom_id: string | null;
  owner_id: string;
  title: string;
  kind: EventKind;
  subject: string | null;
  event_date: string; // YYYY-MM-DD
  event_time: string | null; // HH:MM:SS
  description: string | null;
  remind_days: number;
};

/** Evento tal como lo ve un alumno concreto (con su estado personal). */
export type MyEvent = AgendaEvent & { done: boolean; hidden: boolean; canEdit: boolean };

// ---------------------------------------------------------------- Notas

export type GradePrefs = {
  user_id: string;
  scale_min: number;
  scale_max: number;
  pass_mark: number;
  decimals: number;
  periods: number;
  period_label: string;
};

export type GradeMethod = "promedio" | "ponderado";

export type GradeSubject = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  target: number | null;
  method: GradeMethod;
  position: number;
};

export type GradeCategory = { id: string; subject_id: string; name: string; weight: number; position: number };

export type GradeItem = {
  id: string;
  subject_id: string;
  category_id: string | null;
  period: number;
  name: string;
  score: number | null;
};
