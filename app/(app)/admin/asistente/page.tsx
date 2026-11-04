import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmButton } from "@/components/ConfirmButton";
import { suggestKeywords } from "@/lib/asistente/faq";
import type { Classroom } from "@/lib/types";
import { deleteAnswer, deleteUnknown } from "../actions";
import { AnswerForm, type AnswerRow } from "./AnswerForm";

type Row = { id: string; normalized: string; example: string; count: number; last_at: string };

export default async function AssistantAdminPage({ searchParams }: { searchParams: Promise<{ responder?: string }> }) {
  const { responder } = await searchParams;
  const db = createAdminClient();
  const [{ data, error }, { data: answersData, error: answersError }, { data: roomsData }] = await Promise.all([
    db.from("assistant_unknown").select("*").order("count", { ascending: false }).order("last_at", { ascending: false }).limit(300).returns<Row[]>(),
    db.from("assistant_answers").select("id, question, keywords, answer, classroom_id").order("created_at", { ascending: false }).returns<AnswerRow[]>(),
    db.from("classrooms").select("id, name").order("name").returns<Classroom[]>(),
  ]);
  const rows = data ?? [];
  const answers = answersData ?? [];
  const rooms = roomsData ?? [];
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const pending = rows.find((r) => r.id === responder);

  return (
    <>
      <section className="card" id="ensenar">
        <h2>✏️ Enseñarle una respuesta</h2>
        <p className="muted small">
          Escribe una pregunta, las palabras con que la harían y lo que debe contestar. El asistente la reconoce aunque la pregunten de otra forma.
          Úsalo para info del colegio: vacaciones, horario, temarios, materiales, fechas importantes…
        </p>
        {answersError && <p className="alert alert-error">Falta crear la tabla: ejecuta <code>supabase/007_respuestas_asistente.sql</code> en Supabase.</p>}
        {pending && <p className="alert alert-info">Respondiendo: <b>“{pending.example}”</b> (preguntada {pending.count} {pending.count === 1 ? "vez" : "veces"}). Al guardar, se quita de la lista de no entendidas.</p>}
        <AnswerForm key={responder ?? "nueva"} rooms={rooms} onDoneHref="/admin/asistente"
          preset={pending ? { question: pending.example, keywords: suggestKeywords(pending.example), fromUnknown: pending.id } : undefined} />
      </section>

      <h2 className="section-title">📚 Respuestas que le enseñaste ({answers.length})</h2>
      {!answers.length ? <p className="empty-sm">Todavía no le has enseñado respuestas.</p> : (
        <div className="answer-list">
          {answers.map((a) => (
            <details key={a.id} className="card answer-item">
              <summary>
                <b>“{a.question}”</b>
                <span className="muted small"> · {a.classroom_id ? `Salón ${roomName.get(a.classroom_id) ?? ""}` : "Todos"}</span>
                <p className="small answer-preview">🤖 {a.answer}</p>
              </summary>
              <AnswerForm answer={a} rooms={rooms} />
              <form action={deleteAnswer} className="danger-zone">
                <input type="hidden" name="id" value={a.id} />
                <ConfirmButton message="¿Borrar esta respuesta?" className="btn btn-danger btn-sm">Borrar respuesta</ConfirmButton>
              </form>
            </details>
          ))}
        </div>
      )}

      <h2 className="section-title">🤷 Preguntas que el asistente no entendió</h2>
      <p className="muted small">No se guarda quién las hizo. Toca <b>✏️ Responder</b> para enseñarle. Si necesita calcular algo con notas o agenda, pásasela a Claude.</p>
      {error && <p className="alert alert-error">Falta crear la tabla: ejecuta <code>supabase/003_asistente.sql</code> en Supabase.</p>}
      {!rows.length ? (
        <p className="empty-sm">Todavía no hay preguntas sin entender. 🎉</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pregunta</th><th>Veces</th><th>Última vez</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.id === responder ? "is-selected-row" : ""}>
                    <td>“{r.example}”</td>
                    <td><b>{r.count}</b></td>
                    <td className="nowrap muted small">{new Date(r.last_at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="row-actions">
                      <Link className="btn btn-sm" href={`/admin/asistente?responder=${r.id}#ensenar`}>✏️ Responder</Link>
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
