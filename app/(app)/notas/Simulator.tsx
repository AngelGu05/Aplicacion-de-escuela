"use client";

import { useState } from "react";
import { fmt, periodGrade, yearSummary, type Scale } from "@/lib/grades";
import type { GradeCategory, GradeItem, GradeMethod } from "@/lib/types";

/** "¿Y si saco…?": mueve la barra y mira cómo quedaría el trimestre y el año. */
export function Simulator({
  method, cats, items, scale, target, periodIndex, otherGrades, periodLabel,
}: {
  method: GradeMethod; cats: GradeCategory[]; items: GradeItem[]; scale: Scale; target: number;
  periodIndex: number; otherGrades: (number | null)[]; periodLabel: string;
}) {
  const pending = items.filter((i) => i.score == null).length;
  const step = scale.decimals === 0 ? 1 : 1 / 10 ** scale.decimals;
  const [x, setX] = useState(Math.min(scale.max, Math.max(scale.min, target)));
  if (!pending) return null;

  const g = periodGrade(method, cats, items, x);
  const grades = otherGrades.map((v, i) => (i === periodIndex ? g : v));
  const year = yearSummary(grades, target, scale);
  const okPeriod = g != null && g >= target - 1e-9;

  return (
    <div className="simulator">
      <h3>🎛️ ¿Y si saco…?</h3>
      <p className="small muted">Mueve la barra: es la nota que sacarías en {pending === 1 ? "tu nota pendiente" : `tus ${pending} notas pendientes`}.</p>
      <div className="sim-row">
        <input type="range" min={scale.min} max={scale.max} step={step} value={x}
          onChange={(e) => setX(Number(e.target.value))} aria-label="Nota en las pendientes" style={{ "--p": `${((x - scale.min) / (scale.max - scale.min)) * 100}%` } as React.CSSProperties} />
        <output className="sim-value">{fmt(x, scale.decimals)}</output>
      </div>
      <div className="sim-results">
        <div className={`sim-box ${okPeriod ? "is-ok" : "is-bad"}`}>
          <span>{periodLabel} {periodIndex + 1}</span>
          <b>{fmt(g, scale.decimals)}</b>
          <small>{okPeriod ? "✓ Llegas a la meta" : "✗ No llegas a la meta"}</small>
        </div>
        <div className="sim-box">
          <span>Promedio del año {year.remaining > 0 ? "(hasta ahora)" : ""}</span>
          <b>{fmt(year.average, scale.decimals)}</b>
          <small>
            {year.remaining > 0 && year.needed != null
              ? `Luego necesitarías ${fmt(year.needed, scale.decimals)} en ${year.remaining === 1 ? "el que falta" : `los ${year.remaining} que faltan`}`
              : year.status === "aprobado" ? "✓ Año aprobado" : "✗ Año por debajo de la meta"}
          </small>
        </div>
      </div>
    </div>
  );
}
