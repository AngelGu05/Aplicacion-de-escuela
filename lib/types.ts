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
