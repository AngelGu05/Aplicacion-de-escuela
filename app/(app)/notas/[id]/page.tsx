import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmt, neededOnPending, periodGrade } from "@/lib/grades";
import { getPrefs, normCategory, normItem, normPrefs, normSubject, scaleOf, subjectSummary, SUBJECT_COLORS } from "@/lib/notas";
import type { GradeCategory, GradeItem, GradeSubject } from "@/lib/types";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AddItemForm, SubjectSettingsForm } from "../Forms";
import { Simulator } from "../Simulator";
import { deleteCategory, deleteItem, deleteSubject, saveCategory, updateItemScore } from "../actions";

export default async function SubjectGradesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const { id } = await params;
  const { p } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireUser();
  const prefs = normPrefs(await getPrefs(profile));
  const scale = scaleOf(prefs);
  const db = createAdminClient();

  const { data: raw } = await db.from("grade_subjects").select("*").eq("id", id).eq("user_id", profile.id).maybeSingle<GradeSubject>();
  if (!raw) notFound();
  const subject = normSubject(raw);
  const [{ data: catsRaw }, { data: itemsRaw }] = await Promise.all([
    db.from("grade_categories").select("*").eq("subject_id", id).order("position").returns<GradeCategory[]>(),
    db.from("grade_items").select("*").eq("subject_id", id).order("created_at").returns<GradeItem[]>(),
  ]);
  const cats = (catsRaw ?? []).map(normCategory);
  const items = (itemsRaw ?? []).map(normItem);
  const { grades, target, year } = subjectSummary(subject, cats, items, prefs);

  // Periodo activo: el pedido, o el más reciente que ya tiene notas
  const lastWithItems = Math.max(0, ...items.map((i) => i.period));
  const requested = Number(p);
  const period = requested >= 1 && requested <= prefs.periods ? requested : Math.min(prefs.periods, Math.max(1, lastWithItems));
  const periodItems = items.filter((i) => i.period === period);
  const current = periodGrade(subject.method, cats, periodItems, undefined, scale.decimals);
  const needed = neededOnPending(subject.method, cats, periodItems, target, scale);
  const weightSum = cats.reduce((a, c) => a + c.weight, 0);
  const groups = subject.method === "ponderado"
    ? [...cats.map((c) => ({ key: c.id, title: `${c.name} · ${Math.round((c.weight / (weightSum || 1)) * 1000) / 10}%`, list: periodItems.filter((i) => i.category_id === c.id) })),
       { key: "none", title: "Sin parte (no cuentan)", list: periodItems.filter((i) => !cats.some((c) => c.id === i.category_id)) }].filter((g) => g.key !== "none" || g.list.length)
    : [{ key: "all", title: "Notas", list: periodItems }];

  return (
    <main className="container" style={{ "--accent": subject.color } as React.CSSProperties}>
      <nav className="crumbs"><Link href="/notas">Mis notas</Link> <span>/</span> {subject.name}</nav>
      <section className="page-head accent-bar subject-head">
        <div>
          <h1>{subject.name}</h1>
          <p className="muted">Meta: <b>{target}</b> · {subject.method === "ponderado" ? "por partes con porcentaje" : "promedio simple"}</p>
        </div>
        <div className="year-badge">
          <span>Promedio del año</span>
          <b>{fmt(year.average, scale.decimals)}</b>
        </div>
      </section>

      <nav className="tabs period-tabs">
        {grades.map((g, i) => (
          <Link key={i} href={`/notas/${id}?p=${i + 1}`} className={`tab ${period === i + 1 ? "is-active" : ""}`}>
            {prefs.period_label} {i + 1} <span className={`tab-grade ${g == null ? "" : g >= target ? "is-ok" : "is-bad"}`}>{fmt(g, scale.decimals)}</span>
          </Link>
        ))}
      </nav>

      <div className="notas-layout">
        <section>
          <div className={`needed-card ${needed.status}`}>
            <div className="needed-now">
              <span>Nota actual del {prefs.period_label.toLowerCase()}</span>
              <b>{fmt(current, scale.decimals)}</b>
            </div>
            <div className="needed-text">
              {needed.status === "sin-pendientes" && (
                <p>Agrega una nota <b>pendiente</b> (deja el valor vacío) para la próxima evaluación y te digo cuánto necesitas sacar.</p>
              )}
              {needed.status === "asegurado" && <p>🎉 ¡Ya tienes asegurada la meta de <b>{target}</b> en este {prefs.period_label.toLowerCase()}, aunque saques la nota mínima!</p>}
              {needed.status === "necesita" && (
                <p>Para llegar a <b>{target}</b> necesitas al menos <span className="needed-num">{fmt(needed.value, scale.decimals)}</span> en {periodItems.filter((i) => i.score == null).length === 1 ? "tu nota pendiente" : "cada una de tus notas pendientes"}.</p>
              )}
              {needed.status === "imposible" && (
                <p>😕 Aunque saques {prefs.scale_max} en lo pendiente, llegarías a <b>{fmt(needed.best, scale.decimals)}</b>. Habla con tu profe sobre recuperaciones o trabajos extra.</p>
              )}
            </div>
          </div>

          <Simulator method={subject.method} cats={cats} items={periodItems} scale={scale} target={target}
            periodIndex={period - 1} otherGrades={grades} periodLabel={prefs.period_label} />

          {groups.map((g) => (
            <div key={g.key} className="item-group">
              <h3>{g.title}</h3>
              {!g.list.length ? <p className="empty-sm">Sin notas todavía.</p> : (
                <ul className="item-list">
                  {g.list.map((it) => (
                    <li key={it.id} className={it.score == null ? "is-pending" : it.score >= target ? "is-ok" : "is-bad"}>
                      <span className="item-name">{it.name || (it.score == null ? "Pendiente" : "Nota")}</span>
                      <form action={updateItemScore} className="item-score">
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="subject_id" value={id} />
                        <input name="score" inputMode="decimal" defaultValue={it.score ?? ""} placeholder="—" title="Vacía = pendiente" aria-label="Nota (vacía = pendiente)" />
                        <button className="btn btn-ghost btn-sm" title="Guardar">✓</button>
                      </form>
                      <form action={deleteItem}>
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="subject_id" value={id} />
                        <button className="btn btn-ghost btn-sm" aria-label="Borrar nota">✕</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="card">
            <h3 className="h-card">Agregar nota al {prefs.period_label.toLowerCase()} {period}</h3>
            {subject.method === "ponderado" && !cats.length
              ? <p className="alert alert-error">Primero agrega las partes (Digitación, Apreciación, Bimestral) en la configuración de la materia.</p>
              : <AddItemForm subject={subject} period={period} cats={cats} prefs={prefs} />}
          </div>
        </section>

        <aside className="notas-side">
          {subject.method === "ponderado" && (
            <details className="card" open={!cats.length || Math.abs(weightSum - 100) > 0.5}>
              <summary><b>Partes y porcentajes</b> <span className={`small ${Math.abs(weightSum - 100) > 0.5 ? "text-error" : "muted"}`}>(suman {Math.round(weightSum * 10) / 10}%)</span></summary>
              <ul className="cat-list">
                {cats.map((c) => (
                  <li key={c.id}>
                    <form action={saveCategory} className="cat-form">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="subject_id" value={id} />
                      <input name="name" defaultValue={c.name} aria-label="Nombre" />
                      <input name="weight" inputMode="decimal" defaultValue={Math.round(c.weight * 10) / 10} aria-label="Porcentaje" className="w-input" />
                      <span className="muted">%</span>
                      <button className="btn btn-ghost btn-sm" title="Guardar">✓</button>
                    </form>
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="subject_id" value={id} />
                      <button className="btn btn-ghost btn-sm" aria-label="Borrar parte">✕</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={saveCategory} className="cat-form cat-new">
                <input type="hidden" name="subject_id" value={id} />
                <input name="name" placeholder="Nueva parte" aria-label="Nombre" required />
                <input name="weight" inputMode="decimal" placeholder="%" aria-label="Porcentaje" className="w-input" required />
                <button className="btn btn-sm">Agregar</button>
              </form>
              <p className="small muted">Si los porcentajes no suman 100, se reparten en proporción. Como en Seduca, cada parte se corta a 1 decimal antes de promediar.</p>
            </details>
          )}

          <details className="card">
            <summary><b>⚙️ Configurar materia</b></summary>
            <SubjectSettingsForm subject={subject} prefs={prefs} colors={SUBJECT_COLORS} />
          </details>

          <form action={deleteSubject} className="danger-zone">
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message={`¿Borrar ${subject.name} y todas sus notas?`} className="btn btn-danger btn-sm">Borrar materia</ConfirmButton>
          </form>
        </aside>
      </div>
    </main>
  );
}
