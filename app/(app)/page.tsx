import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subject } from "@/lib/types";

const ICONS: Record<string, string> = { fisica: "🚀", quimica: "⚗️", biologia: "🧬" };

export default async function HomePage() {
  const profile = await requireUser();
  const db = createAdminClient();

  const [{ data: subjects }, { data: lessons }] = await Promise.all([
    db.from("subjects").select("*").order("position").returns<Subject[]>(),
    db.from("lessons").select("subject_id").eq("published", true).returns<{ subject_id: string }[]>(),
  ]);

  const counts = new Map<string, number>();
  lessons?.forEach((l) => counts.set(l.subject_id, (counts.get(l.subject_id) ?? 0) + 1));
  const firstName = (profile.full_name || "").split(" ")[0];

  return (
    <main className="container">
      <section className="page-head">
        <h1>{firstName ? `Hola, ${firstName}` : "Hola"}</h1>
        <p className="muted">Elige una materia para ver las lecciones.</p>
      </section>

      <div className="subject-grid">
        {(subjects ?? []).map((s) => {
          const n = counts.get(s.id) ?? 0;
          return (
            <Link key={s.id} href={`/materias/${s.slug}`} className="subject-card" style={{ "--accent": s.color } as React.CSSProperties}>
              <span className="subject-icon" aria-hidden>{ICONS[s.slug] ?? "📘"}</span>
              <h2>{s.name}</h2>
              {s.description && <p>{s.description}</p>}
              <span className="subject-count">{n === 1 ? "1 publicación" : `${n} publicaciones`}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
