import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmt } from "@/lib/grades";
import { getPrefs, normCategory, normItem, normPrefs, normSubject, scaleOf, subjectSummary, SUBJECT_COLORS } from "@/lib/notas";
import type { GradeCategory, GradeItem, GradeSubject } from "@/lib/types";
import { AddSubjectForm, PrefsForm } from "./Forms";
import { addCommonSubjects } from "./actions";

export const metadata = { title: "Mis notas" };

const STATUS: Record<string, { cls: string; label: string }> = {
  aprobado: { cls: "is-ok", label: "Aprobada ✓" },
  "en-camino": { cls: "is-ok", label: "Vas bien" },
  "en-riesgo": { cls: "is-warn", label: "Ojo" },
  imposible: { cls: "is-bad", label: "Difícil" },
  reprobado: { cls: "is-bad", label: "Por debajo" },
  "sin-datos": { cls: "is-none", label: "Sin notas" },
};

export default async function NotasPage() {
  const profile = await requireUser();
  const prefs = normPrefs(await getPrefs(profile));
  const scale = scaleOf(prefs);
  const db = createAdminClient();

  const { data: subjectsRaw } = await db.from("grade_subjects").select("*").eq("user_id", profile.id).order("position").order("created_at").returns<GradeSubject[]>();
  const subjects = (subjectsRaw ?? []).map(normSubject);
  const ids = subjects.map((s) => s.id);
  const [{ data: catsRaw }, { data: itemsRaw }] = ids.length
    ? await Promise.all([
        db.from("grade_categories").select("*").in("subject_id", ids).returns<GradeCategory[]>(),
        db.from("grade_items").select("*").in("subject_id", ids).returns<GradeItem[]>(),
      ])
    : [{ data: [] as GradeCategory[] }, { data: [] as GradeItem[] }];
  const cats = (catsRaw ?? []).map(normCategory);
  const items = (itemsRaw ?? []).map(normItem);

  const rows = subjects.map((s) => ({ s, ...subjectSummary(s, cats.filter((c) => c.subject_id === s.id), items.filter((i) => i.subject_id === s.id), prefs) }));
  const atRisk = rows.filter((r) => ["en-riesgo", "imposible", "reprobado"].includes(r.year.status)).length;
  const known = rows.map((r) => r.year.average).filter((x): x is number => x != null);
  const overall = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;

  return (
    <main className="container">
      <section className="hero hero-sm">
        <span className="hero-kicker">🔒 Solo tú ves tus notas</span>
        <h1>Mis notas 📊</h1>
        <p>Anota tus calificaciones y te digo cuánto necesitas para pasar o para llegar a tu meta.</p>
      </section>

      {rows.length > 0 && (
        <div className="stat-row">
          <div className="stat"><span>Promedio general</span><b>{fmt(overall, scale.decimals)}</b></div>
          <div className="stat"><span>Materias</span><b>{rows.length}</b></div>
          <div className={`stat ${atRisk ? "stat-warn" : "stat-ok"}`}><span>En riesgo</span><b>{atRisk}</b></div>
          <div className="stat"><span>Escala</span><b className="stat-sm">{prefs.scale_min}–{prefs.scale_max} · pasa {prefs.pass_mark}</b></div>
        </div>
      )}

      {rows.length === 0 ? (
        <section className="card empty-notas">
          <h2>Empieza agregando tus materias</h2>
          <p className="muted">Carga de un clic las 13 materias del colegio, ya divididas en <b>Digitación</b>, <b>Apreciación</b> y <b>Bimestral</b>, y calculadas igual que en Seduca.</p>
          <form action={addCommonSubjects}><button className="btn btn-primary">✨ Cargar mis materias del colegio</button></form>
        </section>
      ) : (
        <div className="grade-grid">
          {rows.map(({ s, grades, target, year }) => {
            const st = STATUS[year.status];
            let msg: string;
            if (year.status === "sin-datos") msg = "Agrega tus notas para ver cómo vas.";
            else if (year.status === "aprobado") msg = `Terminaste con ${fmt(year.average, scale.decimals)}.`;
            else if (year.status === "reprobado") msg = `Quedaste por debajo de ${target}.`;
            else if (year.status === "imposible") msg = `Aunque saques ${prefs.scale_max} no llegas a ${target} este año.`;
            else msg = `Necesitas promediar ${fmt(year.needed, scale.decimals)} en ${year.remaining === 1 ? "el periodo que falta" : `los ${year.remaining} que faltan`}.`;
            return (
              <Link key={s.id} href={`/notas/${s.id}`} className="grade-card" style={{ "--accent": s.color } as React.CSSProperties}>
                <div className="grade-card-top">
                  <h2>{s.name}</h2>
                  <span className={`status-pill ${st.cls}`}>{st.label}</span>
                </div>
                <div className="grade-big">
                  <b>{fmt(year.average, scale.decimals)}</b>
                  <span>meta {target}</span>
                </div>
                <div className="period-chips">
                  {grades.map((g, i) => (
                    <span key={i} className={`period-chip ${g == null ? "is-empty" : g >= target ? "is-ok" : "is-bad"}`}>
                      <small>{prefs.period_label.slice(0, 1)}{i + 1}</small> {fmt(g, scale.decimals)}
                    </span>
                  ))}
                </div>
                <p className="grade-msg">{msg}</p>
              </Link>
            );
          })}
        </div>
      )}

      <div className="two-col">
        <details className="card">
          <summary><b>+ Agregar materia</b></summary>
          <AddSubjectForm colors={SUBJECT_COLORS} />
          <form action={addCommonSubjects} className="reload-subjects">
            <button className="btn btn-ghost btn-sm">↺ Cargar las materias del colegio que me falten</button>
          </form>
        </details>
        <details className="card">
          <summary><b>⚙️ Escala de notas</b> <span className="muted small">({prefs.scale_min} a {prefs.scale_max}, pasa con {prefs.pass_mark})</span></summary>
          <PrefsForm prefs={prefs} />
        </details>
      </div>
    </main>
  );
}
