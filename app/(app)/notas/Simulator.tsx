"use client";

import { useMemo, useState } from "react";
import { finalDecimals, fmt, neededOnPending, periodGrade, truncTo, yearSummary, type Scale } from "@/lib/grades";
import type { GradeCategory, GradeItem, GradeMethod } from "@/lib/types";
import { addItemQuick, updateItemScore } from "./actions";

type Sim = { key: string; catId: string | null; value: number; fromId?: string; name: string };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * "¿Y si saco…?": agrega notas simuladas (no se guardan) y mira al instante
 * cómo quedan cada parte, el bimestre, la nota final del año y tu promedio general.
 */
export function Simulator({
  subjectId, method, cats, items, scale, target, passMark, periodIndex, periodGrades, otherFinals, periodLabel,
}: {
  subjectId: string; method: GradeMethod; cats: GradeCategory[]; items: GradeItem[]; scale: Scale; target: number; passMark: number;
  periodIndex: number; periodGrades: (number | null)[]; otherFinals: (number | null)[]; periodLabel: string;
}) {
  const ponderado = method === "ponderado" && cats.length > 0;
  const step = scale.decimals === 0 ? 1 : 1 / 10 ** scale.decimals;
  const fd = finalDecimals(scale);
  const reales = items.filter((i) => i.score != null);
  const pendientes = items.filter((i) => i.score == null);
  const defaultValue = Math.min(scale.max, Math.max(scale.min, target));
  const bimestral = cats.find((c) => /bimestral|examen/i.test(c.name));

  const [sims, setSims] = useState<Sim[]>(() =>
    pendientes.map((p) => ({ key: p.id, catId: p.category_id, value: defaultValue, fromId: p.id, name: p.name || "Pendiente" })));
  const [goalCat, setGoalCat] = useState<string>(cats.find((c) => c.id !== bimestral?.id)?.id ?? cats[0]?.id ?? "");
  const [goal, setGoal] = useState<number>(target);

  const simItems: GradeItem[] = useMemo(() => [
    ...reales,
    ...sims.map((s) => ({ id: s.key, subject_id: subjectId, category_id: s.catId, period: periodIndex + 1, name: s.name, score: s.value })),
  ], [reales, sims, subjectId, periodIndex]);

  const antes = periodGrade(method, cats, reales, undefined, scale.decimals);
  const ahora = periodGrade(method, cats, simItems, undefined, scale.decimals);
  const grades = periodGrades.map((g, i) => (i === periodIndex ? ahora : g));
  const year = yearSummary(grades, passMark, scale);
  const finales = [...otherFinals, year.average].filter((x): x is number => x != null);
  const general = finales.length ? truncTo(finales.reduce((a, b) => a + b, 0) / finales.length, fd) : null;

  const partes = ponderado ? cats.map((c) => {
    const r = mean(reales.filter((i) => i.category_id === c.id).map((i) => i.score!));
    const s = mean(simItems.filter((i) => i.category_id === c.id).map((i) => i.score!));
    return { c, antes: r == null ? null : truncTo(r, scale.decimals), ahora: s == null ? null : truncTo(s, scale.decimals) };
  }) : [];

  // ¿Cuánto necesito en mi próxima nota de X para llegar a Y?
  const need = useMemo(() => {
    const virtual: GradeItem = { id: "next", subject_id: subjectId, category_id: ponderado ? goalCat : null, period: periodIndex + 1, name: "Próxima", score: null };
    return neededOnPending(method, cats, [...simItems, virtual], goal, scale);
  }, [simItems, goalCat, goal, method, cats, scale, subjectId, periodIndex, ponderado]);
  const goalCatName = cats.find((c) => c.id === goalCat)?.name ?? "tu próxima nota";

  const add = (catId: string | null) => setSims((xs) => [...xs, { key: `sim-${Date.now()}-${xs.length}`, catId, value: defaultValue, name: "Simulada" }]);
  const flecha = (a: number | null, b: number | null) => a == null || b == null || a === b ? "" : b > a ? " ▲" : " ▼";

  return (
    <div className="simulator">
      <h3>🎛️ ¿Y si saco…?</h3>
      <p className="small muted">Agrega notas simuladas y mueve la barra. <b>No se guardan</b> a menos que toques 💾.</p>

      {sims.length > 0 && (
        <div className="sim-list">
          {sims.map((s) => (
            <div key={s.key} className="sim-item">
              <div className="sim-item-top">
                {ponderado ? (
                  <select value={s.catId ?? ""} onChange={(e) => setSims((xs) => xs.map((x) => (x.key === s.key ? { ...x, catId: e.target.value } : x)))} aria-label="Parte">
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : <span className="small">Nota</span>}
                <span className={`sim-tag ${s.fromId ? "is-pending" : ""}`}>{s.fromId ? `Pendiente: ${s.name}` : "Simulada"}</span>
                <output className="sim-value">{fmt(s.value, scale.decimals)}</output>
                <form action={s.fromId ? updateItemScore : addItemQuick} onSubmit={() => setTimeout(() => setSims((xs) => xs.filter((x) => x.key !== s.key)), 50)}>
                  <input type="hidden" name="subject_id" value={subjectId} />
                  {s.fromId ? <input type="hidden" name="id" value={s.fromId} /> : <>
                    <input type="hidden" name="period" value={periodIndex + 1} />
                    <input type="hidden" name="category_id" value={s.catId ?? ""} />
                    <input type="hidden" name="name" value="" />
                  </>}
                  <input type="hidden" name="score" value={s.value} />
                  <button className="btn btn-ghost btn-sm" title="Guardar como nota real">💾</button>
                </form>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSims((xs) => xs.filter((x) => x.key !== s.key))} aria-label="Quitar">✕</button>
              </div>
              <input type="range" min={scale.min} max={scale.max} step={step} value={s.value}
                onChange={(e) => setSims((xs) => xs.map((x) => (x.key === s.key ? { ...x, value: Number(e.target.value) } : x)))} aria-label="Nota simulada" />
            </div>
          ))}
        </div>
      )}

      <div className="sim-add">
        {ponderado ? cats.map((c) => <button key={c.id} type="button" className="btn btn-sm" onClick={() => add(c.id)}>➕ {c.name}</button>)
          : <button type="button" className="btn btn-sm" onClick={() => add(null)}>➕ Simular una nota</button>}
      </div>

      <div className="sim-results">
        {partes.map((p) => (
          <div key={p.c.id} className="sim-box small-box">
            <span>{p.c.name}</span>
            <b>{fmt(p.ahora, scale.decimals)}<small className="sim-delta">{flecha(p.antes, p.ahora)}</small></b>
            <small>antes {fmt(p.antes, scale.decimals)}</small>
          </div>
        ))}
        <div className={`sim-box ${ahora == null ? "" : ahora >= target ? "is-ok" : "is-bad"}`}>
          <span>{periodLabel} {periodIndex + 1}</span>
          <b>{fmt(ahora, scale.decimals)}<small className="sim-delta">{flecha(antes, ahora)}</small></b>
          <small>antes {fmt(antes, scale.decimals)} · meta {target}</small>
        </div>
        <div className="sim-box">
          <span>Nota final del año</span>
          <b>{fmt(year.average, fd)}</b>
          <small>{year.remaining > 0 && year.needed != null ? `Pa' pasar el año: ${fmt(year.needed, scale.decimals)} en lo que falta` : year.status === "aprobado" ? "✓ Año aprobado" : "Promedio de los bimestres"}</small>
        </div>
        <div className="sim-box">
          <span>Promedio general</span>
          <b>{fmt(general, fd)}</b>
          <small>todas las materias</small>
        </div>
      </div>

      <div className="sim-need">
        <span>¿Cuánto necesito en mi próxima nota de</span>
        {ponderado && (
          <select value={goalCat} onChange={(e) => setGoalCat(e.target.value)} aria-label="Parte">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <span>para quedar con</span>
        <input type="number" min={scale.min} max={scale.max} step={step} value={goal} onChange={(e) => setGoal(Number(e.target.value))} aria-label="Meta del bimestre" />
        <span>en el {periodLabel.toLowerCase()}?</span>
        <p className="sim-need-answer">
          {need.status === "necesita" && <>👉 Necesitas al menos <b>{fmt(need.value, scale.decimals)}</b> en tu próxima nota de {goalCatName}.</>}
          {need.status === "asegurado" && <>🎉 Ya lo tienes: aunque saques {fmt(scale.min, scale.decimals)} quedas con {fmt(goal, scale.decimals)} o más.</>}
          {need.status === "imposible" && <>😕 Con una sola nota no alcanza: aunque saques {fmt(scale.max, scale.decimals)} quedarías en {fmt(need.best, scale.decimals)}.</>}
          {need.status === "sin-pendientes" && <>Agrega notas para calcular.</>}
        </p>
      </div>
    </div>
  );
}
