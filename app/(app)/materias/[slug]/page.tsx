import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPremium, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LESSON_SUMMARY_COLUMNS, type LessonSummary, type Subject } from "@/lib/types";

export default async function SubjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await requireUser();
  const db = createAdminClient();

  const { data: subject } = await db.from("subjects").select("*").eq("slug", slug).maybeSingle<Subject>();
  if (!subject) notFound();

  let query = db
    .from("lessons")
    .select(LESSON_SUMMARY_COLUMNS)
    .eq("subject_id", subject.id)
    .order("created_at", { ascending: false });
  if (profile.role !== "admin") query = query.eq("published", true);
  const { data: lessons } = await query.returns<LessonSummary[]>();

  const canPremium = hasPremium(profile);

  return (
    <main className="container" style={{ "--accent": subject.color } as React.CSSProperties}>
      <nav className="crumbs"><Link href="/">Materias</Link> <span>/</span> {subject.name}</nav>
      <section className="page-head accent-bar">
        <h1>{subject.name}</h1>
        {subject.description && <p className="muted">{subject.description}</p>}
      </section>

      {!lessons?.length ? (
        <p className="empty">Todavía no hay publicaciones en {subject.name}.</p>
      ) : (
        <ul className="lesson-list">
          {lessons.map((l) => {
            const locked = l.is_premium && !canPremium;
            const date = new Date(l.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
            const inner = (
              <>
                <div className="lesson-meta">
                  <span className={`tag tag-${l.kind}`}>{l.kind === "aviso" ? "Aviso" : "Lección"}</span>
                  {l.is_premium && <span className="tag tag-premium">Premium</span>}
                  {!l.published && <span className="tag tag-draft">Oculta</span>}
                  <span className="lesson-date">{date}</span>
                </div>
                <h2>{locked && "🔒 "}{l.title}</h2>
                {l.description && <p>{l.description}</p>}
                {locked && <p className="locked-note">Contenido Premium — pídele acceso al administrador.</p>}
              </>
            );
            return (
              <li key={l.id}>
                {locked ? (
                  <div className="lesson-item is-locked">{inner}</div>
                ) : (
                  <Link className="lesson-item" href={`/materias/${subject.slug}/${l.id}`}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
