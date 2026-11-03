import { createAdminClient } from "@/lib/supabase/admin";
import type { Classroom, Profile, Subject } from "@/lib/types";
import { todayISO } from "@/lib/time";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteClassroom, deleteStudent, forceLogout, setStudentClassroom, setStudentFlag, setSubjectAccess } from "../actions";
import { NewClassroomForm, NewStudentForm, ResetPasswordForm } from "./StudentForms";

function FlagButton({ id, flag, value, on, off }: { id: string; flag: "disabled" | "can_edit_agenda"; value: boolean; on: string; off: string }) {
  return (
    <form action={setStudentFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={String(!value)} />
      <button className={`pill ${value ? (flag === "disabled" ? "pill-danger" : "pill-on") : ""}`} title="Clic para cambiar">{value ? on : off}</button>
    </form>
  );
}

type GrantRow = { user_id: string; subject_id: string; expires_at: string | null };
const shortDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" });

/** Botones por materia: dorado = tiene acceso; con fecha = vence; tachado = vencido. */
function AccessChips({ studentId, subjects, grants, today }: { studentId: string; subjects: Subject[]; grants: GrantRow[]; today: string }) {
  return (
    <div className="grant-chips">
      {subjects.map((sub) => {
        const g = grants.find((x) => x.subject_id === sub.id);
        const expired = !!g?.expires_at && g.expires_at < today;
        const label = g ? `${sub.name}${g.expires_at ? ` · ${expired ? "venció" : "hasta"} ${shortDate(g.expires_at)}` : ""}` : sub.name;
        return (
          <form key={sub.id} action={setSubjectAccess}>
            <input type="hidden" name="id" value={studentId} />
            <input type="hidden" name="subject_id" value={sub.id} />
            <input type="hidden" name="grant" value={g && !expired ? "false" : "true"} />
            <button className={`pill ${g ? (expired ? "pill-expired" : "pill-gold") : ""}`}
              title={g && !expired ? `Quitar acceso a ${sub.name}` : `Dar acceso a ${sub.name} (sin vencimiento)`}>
              {g && !expired ? "⭐ " : ""}{label}
            </button>
          </form>
        );
      })}
    </div>
  );
}

function fmt(date: string | null) {
  return date ? new Date(date).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "Nunca";
}

export default async function StudentsPage() {
  const { data: classrooms } = await createAdminClient().from("classrooms").select("id, name").order("name").returns<Classroom[]>();
  const { data: subjectsData } = await createAdminClient().from("subjects").select("*").order("position").returns<Subject[]>();
  const subjects = subjectsData ?? [];
  const { data: grantsData, error: grantsError } = await createAdminClient().from("subject_access").select("user_id, subject_id, expires_at").returns<GrantRow[]>();
  const grants = grantsData ?? [];
  const today = todayISO();
  const rooms = classrooms ?? [];
  const { data: students } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  return (
    <>
      <section className="card">
        <h2>Salones</h2>
        <p className="muted small">Cada alumno ve en su agenda los eventos de su salón. Los <b>editores</b> pueden publicar eventos para su propio salón.</p>
        <div className="room-chips">
          {rooms.map((r) => (
            <form key={r.id} action={deleteClassroom} className="room-chip">
              <input type="hidden" name="id" value={r.id} />
              <span>{r.name}</span>
              <ConfirmButton message={`¿Borrar el salón ${r.name}? Sus eventos también se borrarán.`} className="room-x">✕</ConfirmButton>
            </form>
          ))}
          {!rooms.length && <span className="muted small">Todavía no hay salones.</span>}
        </div>
        <NewClassroomForm />
      </section>

      {grantsError && <p className="alert alert-error">Para dar acceso por materia, ejecuta <code>supabase/004_acceso_por_materia.sql</code> en Supabase.</p>}
      <NewStudentForm classrooms={rooms} subjects={subjects} />

      <h2 className="section-title">Alumnos ({students?.length ?? 0})</h2>
      {!students?.length ? (
        <p className="empty-sm">Todavía no hay alumnos.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Alumno</th><th>Sesión</th><th>Salón</th><th>Acceso Premium</th><th>Agenda</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.full_name || "—"}</strong>
                    <div className="muted small">{s.email}</div>
                  </td>
                  <td>
                    {s.active_session_id ? <span className="dot dot-on">Conectado</span> : <span className="dot">Sin sesión</span>}
                    <div className="muted small">Último ingreso: {fmt(s.last_login_at)}</div>
                  </td>
                  <td>
                    <form action={setStudentClassroom} className="room-select">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="classroom_id" defaultValue={s.classroom_id ?? ""} aria-label="Salón">
                        <option value="">—</option>
                        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" title="Guardar salón">✓</button>
                    </form>
                  </td>
                  <td><AccessChips studentId={s.id} subjects={subjects} grants={grants.filter((g) => g.user_id === s.id)} today={today} /></td>
                  <td><FlagButton id={s.id} flag="can_edit_agenda" value={s.can_edit_agenda} on="Editor" off="Normal" /></td>
                  <td><FlagButton id={s.id} flag="disabled" value={s.disabled} on="Suspendido" off="Activo" /></td>
                  <td>
                    <details className="actions-menu">
                      <summary className="btn btn-ghost btn-sm">Opciones</summary>
                      <div className="actions-panel">
                        <form action={setSubjectAccess} className="grant-form">
                          <input type="hidden" name="id" value={s.id} />
                          <span className="small"><b>Acceso Premium</b></span>
                          <select name="subject_id" aria-label="Materia" defaultValue="todas">
                            <option value="todas">Todas las materias</option>
                            {subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                          </select>
                          <label className="small">hasta <input type="date" name="expires_at" min={today} aria-label="Vence el (opcional)" /></label>
                          <button className="btn btn-sm btn-primary" name="grant" value="true">Dar</button>
                          <button className="btn btn-sm" name="grant" value="false">Quitar</button>
                        </form>
                        <p className="small muted">Sin fecha = no vence. Con fecha, el acceso dura hasta ese día incluido.</p>
                        <ResetPasswordForm id={s.id} />
                        <div className="row-actions">
                          <form action={forceLogout}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="btn btn-sm" disabled={!s.active_session_id}>Cerrar su sesión</button>
                          </form>
                          <form action={deleteStudent}>
                            <input type="hidden" name="id" value={s.id} />
                            <ConfirmButton message={`¿Borrar la cuenta de ${s.email}? No se puede deshacer.`} className="btn btn-danger btn-sm">Borrar cuenta</ConfirmButton>
                          </form>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
