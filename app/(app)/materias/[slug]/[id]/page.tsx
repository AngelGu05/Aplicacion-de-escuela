import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeePremium, premiumAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProtectedFrame } from "@/components/ProtectedFrame";
import { LESSON_SUMMARY_COLUMNS, type LessonSummary, type Subject } from "@/lib/types";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireUser();
  const db = createAdminClient();

  const [{ data: subject }, { data: lesson }] = await Promise.all([
    db.from("subjects").select("*").eq("slug", slug).maybeSingle<Subject>(),
    db.from("lessons").select(LESSON_SUMMARY_COLUMNS).eq("id", id).maybeSingle<LessonSummary>(),
  ]);

  if (!subject || !lesson || lesson.subject_id !== subject.id) notFound();
  if (!lesson.published && profile.role !== "admin") notFound();

  const locked = lesson.is_premium && !canSeePremium(await premiumAccess(profile), subject.id);

  return (
    <main className="lesson-page" style={{ "--accent": subject.color } as React.CSSProperties}>
      <div className="lesson-bar">
        <nav className="crumbs">
          <Link href="/">Materias</Link> <span>/</span>{" "}
          <Link href={`/materias/${subject.slug}`}>{subject.name}</Link> <span>/</span> {lesson.title}
        </nav>
      </div>
      {locked ? (
        <div className="container">
          <p className="empty">🔒 Esta lección es contenido Premium de {subject.name}. Pídele acceso a {subject.name} al administrador.</p>
        </div>
      ) : (
        <ProtectedFrame lessonId={lesson.id} title={lesson.title} />
      )}
    </main>
  );
}
