import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteUnknown } from "../actions";

type Row = { id: string; normalized: string; example: string; count: number; last_at: string };

export default async function AssistantAdminPage() {
  const { data, error } = await createAdminClient()
    .from("assistant_unknown").select("*").order("count", { ascending: false }).order("last_at", { ascending: false }).limit(300).returns<Row[]>();
  const rows = data ?? [];

  return (
    <>
      <section className="card">
        <h2>Preguntas que el asistente no entendió</h2>
        <p className="muted small">
          No se guarda quién las hizo. Úsalas para saber qué enseñarle: pásale esta lista a Claude para que el asistente aprenda a responderlas.
        </p>
        {error && <p className="alert alert-error">Falta crear la tabla: ejecuta <code>supabase/003_asistente.sql</code> en Supabase.</p>}
      </section>
      {!rows.length ? (
        <p className="empty-sm">Todavía no hay preguntas sin entender. 🎉</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pregunta</th><th>Veces</th><th>Última vez</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>“{r.example}”</td>
                    <td><b>{r.count}</b></td>
                    <td className="nowrap muted small">{new Date(r.last_at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td>
                      <form action={deleteUnknown}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn-ghost btn-sm" aria-label="Quitar">✕</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={deleteUnknown} className="danger-zone">
            <input type="hidden" name="id" value="todas" />
            <ConfirmButton message="¿Borrar toda la lista?" className="btn btn-danger btn-sm">Borrar toda la lista</ConfirmButton>
          </form>
        </>
      )}
    </>
  );
}
