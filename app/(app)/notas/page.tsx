import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmt, neededOnPending, truncTo } from "@/lib/grades";
import { ensureStarterSubjects, getPrefs, normCategory, normItem, normPrefs, normSubject, scaleOf, subjectSummary, SUBJECT_COLORS } from "@/lib/notas";
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

/** Si una materia aún no tiene el bimestral de ese periodo, se supone pendiente para calcular cuánto falta. */
function withPendingBimestral(cats: GradeCategory[], items: GradeItem[], period: number, subjectId: string): GradeItem[] {
  if (!items.length || items.some((i) => i.score == null)) return items;
  const bim = cats.find((c) => /bimestral|examen/i.test(c.name));
  if (!bim || items.some((i) => i.category_id === bim.id)) return items;
  return [...items, { id: "virtual", subject_id: subjectId, category_id: bim.id, period, name: "Bimestral", score: null }];
}

export default async function NotasPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const profile = await requireUser();
  await ensureStarterSubjects(profile);
  const prefs = normPrefs(await getPrefs(profile));
  const bRaw = Number((await searchParams).b);
  const vista = bRaw >= 1 && bRaw <= prefs.periods ? bRaw : 0; // 0 = general
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
  const avg = (xs: (number | null)[]) => {
    const k = xs.filter((x): x is number => x != null);
    return k.length ? truncTo(k.reduce((a, b) => a + b, 0) / k.length, scale.decimals) : null;
  };
  const periodNums = Array.from({ length: prefs.periods }, (_, i) => i + 1);
  const overall = vista ? avg(rows.map((r) => r.grades[vista - 1])) : avg(rows.map((r) => r.year.average));
  const perPeriod = periodNums.map((p) => avg(rows.map((r) => r.grades[p - 1])));
  const label = prefs.period_label;
  const ini = label.slice(0, 1);

  return (
    <main className="container">
      <section className="hero hero-sm">
        <span className="hero-kicker">🔒 Solo tú ves tus notas</span>
        <h1>Mis notas 📊</h1>
        <p>Anota tus calificaciones y te digo cuánto necesitas para pasar o para llegar a tu meta.</p>
        <div className="hero-actions">
          <Link href="/notas/importar" className="btn btn-primary">📋 Importar desde Seduca</Link>
        </div>
      </section>

      {rows.length > 0 && (
        <nav className="tabs period-tabs">
          <Link href="/notas" className={`tab ${vista === 0 ? "is-active" : ""}`}>📋 General</Link>
          {periodNums.map((p) => (
            <Link key={p} href={`/notas?b=${p}`} className={`tab ${vista === p ? "is-active" : ""}`}>
              {label} {p} <span className="tab-grade">{fmt(perPeriod[p - 1], scale.decimals)}</span>
            </Link>
          ))}
        </nav>
      )}

      {rows.length > 0 && (
        <div className="stat-row">
          <div className="stat"><span>{vista ? `Promedio del ${label.toLowerCase()} ${vista}` : "Promedio general del año"}</span><b>{fmt(overall, scale.decimals)}</b></div>
          <div className="stat"><span>Materias</span><b>{rows.length}</b></div>
          <div className={`stat ${atRisk ? "stat-warn" : "stat-ok"}`}><span>En riesgo</span><b>{atRisk}</b></div>
          <div className="stat"><span>Escala</span><b className="stat-sm">{prefs.scale_min}–{prefs.scale_max} · pasa {prefs.pass_mark}</b></div>
        </div>
      )}

      {rows.length === 0 ? (
        <section className="card empty-notas">
          <h2>Empieza agregando tus materias</h2>
          <p className="muted">Carga de un clic las 11 materias del colegio, ya divididas en <b>Digitación</b>, <b>Apreciación</b> y <b>Bimestral</b>, y calculadas igual que en Seduca.</p>
          <div className="hero-actions center">
            <Link href="/notas/importar" className="btn btn-primary">📋 Importar mis notas de Seduca</Link>
            <form action={addCommonSubjects}><button className="btn">✨ Solo cargar las materias</button></form>
          </div>
        </section>
      ) : (
        <>
        {vista === 0 && (
          <section className="boletin">
            <h2 className="section-title">📋 Boletín</h2>
            <div className="table-wrap">
              <table className="table boletin-table">
                <thead>
                  <tr><th>Materia</th>{periodNums.map((p) => <th key={p} className="num">{ini}{p}</th>)}<th className="num">Final</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ s, grades, target, year }) => (
                    <tr key={s.id}>
                      <td><Link href={`/notas/${s.id}`} className="boletin-subject"><i style={{ background: s.color }} />{s.name}</Link></td>
                      {grades.map((g, i) => (
                        <td key={i} className="num"><Link href={`/notas/${s.id}?p=${i + 1}`} className={`g-cell ${g == null ? "is-empty" : g >= target ? "is-ok" : "is-bad"}`}>{fmt(g, scale.decimals)}</Link></td>
                      ))}
                      <td className="num"><b className={`g-cell ${year.average == null ? "is-empty" : year.average >= target ? "is-ok" : "is-bad"}`}>{fmt(year.average, scale.decimals)}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th>Promedio</th>{perPeriod.map((g, i) => <th key={i} className="num">{fmt(g, scale.decimals)}</th>)}<th className="num">{fmt(overall, scale.decimals)}</th></tr>
                </tfoot>
              </table>
            </div>
            <p className="small muted">La nota final es el promedio de los {label.toLowerCase()}s que ya tienen nota (cortado a {scale.decimals} decimal{scale.decimals === 1 ? "" : "es"}, como en Seduca). Toca una nota para ver el detalle.</p>
          </section>
        )}
        {vista > 0 && !rows.some((r) => r.grades[vista - 1] != null) && (
          <section className="card empty-notas">
            <h2>Todavía no hay notas del {label.toLowerCase()} {vista}</h2>
            <p className="muted">Impórtalas desde Seduca eligiendo <b>{label} {vista}</b>, o agrégalas a mano en cada materia.</p>
            <div className="hero-actions center"><Link href="/notas/importar" className="btn btn-primary">📋 Importar el {label.toLowerCase()} {vista}</Link></div>
          </section>
        )}
        {vista > 0 && (
          <div className="grade-grid">
            {rows.map(({ s, grades, target }) => {
              const g = grades[vista - 1];
              const sc = cats.filter((c) => c.subject_id === s.id);
              const it = withPendingBimestral(sc, items.filter((i) => i.subject_id === s.id && i.period === vista), vista, s.id);
              const n = neededOnPending(s.method, sc, it, target, scale);
              const st = g == null ? STATUS["sin-datos"] : n.status === "necesita" ? (n.value >= 4 ? STATUS["en-riesgo"] : { cls: "is-ok", label: "Vas bien" }) : n.status === "imposible" ? STATUS.imposible : g >= target ? { cls: "is-ok", label: "Bien ✓" } : STATUS.reprobado;
              const msg = g == null ? "Sin notas en este bimestre."
                : n.status === "necesita" ? `Necesitas ${fmt(n.value, scale.decimals)} en lo pendiente para llegar a ${target}.`
                : n.status === "asegurado" ? `Ya tienes asegurado el ${target}. 🎉`
                : n.status === "imposible" ? `Aunque saques ${prefs.scale_max}, quedarías en ${fmt(n.best, scale.decimals)}.`
                : g >= target ? "Bimestre completo. ✅" : `Quedó por debajo de ${target}.`;
              return (
                <Link key={s.id} href={`/notas/${s.id}?p=${vista}`} className="grade-card" style={{ "--accent": s.color } as React.CSSProperties}>
                  <div className="grade-card-top"><h2>{s.name}</h2><span className={`status-pill ${st.cls}`}>{st.label}</span></div>
                  <div className="grade-big"><b>{fmt(g, scale.decimals)}</b><span>{label.toLowerCase()} {vista} · meta {target}</span></div>
                  <p className="grade-msg">{msg}</p>
                </Link>
              );
            })}
          </div>
        )}
        {vista === 0 && <h2 className="section-title">Por materia</h2>}
        {vista === 0 && (
        <div className="grade-grid">
          {rows.map(({ s, grades, target, year }) => {
            const st = STATUS[year.status];
            let msg: string;
            if (year.status === "sin-datos") msg = "Agrega tus notas para ver cómo vas.";
            else if (year.status === "aprobado") msg = `Terminaste con ${fmt(year.average, scale.decimals)}.`;
            else if (year.status === "reprobado") msg = `Quedaste por debajo de ${target}.`;
            else if (year.status === "imposible") msg = `Aunque saques ${prefs.scale_max} no llegas a ${target} este año.`;
            else msg = `Necesitas promediar ${fmt(year.needed, scale.decimals)} en ${year.remaining === 1 ? `el ${label.toLowerCase()} que falta` : `los ${year.remaining} ${label.toLowerCase()}s que faltan`}.`;
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
        </>
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
