import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { LESSON_SUMMARY_COLUMNS, type LessonSummary, type Subject } from "@/lib/types";
import { toggleLessonFlag } from "./actions";

function Toggle({ id, flag, value, on, off }: { id: string; flag: string; value: boolean; on: string; off: string }) {
  return (
    <form action={toggleLessonFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={String(!value)} />
      <button className={`pill ${value ? "pill-on" : ""}`} title="Clic para cambiar">{value ? on : off}</button>
    </form>
  );
}

export default async function AdminLessonsPage() {
  const db = createAdminClient();
  const [{ data: subjects }, { data: lessons }] = await Promise.all([
    db.from("subjects").select("*").order("position").returns<Subject[]>(),
    db.from("lessons").select(LESSON_SUMMARY_COLUMNS).order("created_at", { ascending: false }).returns<LessonSummary[]>(),
  ]);

  return (
    <>
      <div className="toolbar">
        <p className="muted">{lessons?.length ?? 0} publicaciones</p>
        <Link href="/admin/lecciones/nueva" className="btn btn-primary">+ Nueva publicación</Link>
      </div>

      {(subjects ?? []).map((s) => {
        const items = (lessons ?? []).filter((l) => l.subject_id === s.id);
        return (
          <section key={s.id} className="admin-section" style={{ "--accent": s.color } as React.CSSProperties}>
            <h2 className="accent-bar">{s.name} <span className="muted">({items.length})</span></h2>
            {!items.length ? (
              <p className="empty-sm">Sin publicaciones.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Título</th><th>Tipo</th><th>Visible</th><th>Acceso</th><th></th></tr>
                  </thead>
                  <tbody>
                    {items.map((l) => (
                      <tr key={l.id}>
                        <td><strong>{l.title}</strong>{l.description && <div className="muted small">{l.description}</div>}</td>
                        <td>{l.kind === "aviso" ? "Aviso" : "Lección"}</td>
                        <td><Toggle id={l.id} flag="published" value={l.published} on="Publicada" off="Oculta" /></td>
                        <td><Toggle id={l.id} flag="is_premium" value={l.is_premium} on="Premium" off="Libre" /></td>
                        <td className="row-actions">
                          <Link href={`/materias/${s.slug}/${l.id}`} className="btn btn-ghost btn-sm">Ver</Link>
                          <Link href={`/admin/lecciones/${l.id}`} className="btn btn-ghost btn-sm">Editar</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
