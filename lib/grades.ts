/**
 * Cálculo de notas. Funciones puras (sin base de datos), usadas en el servidor y en el simulador.
 *
 * - Una materia tiene notas por periodo (trimestre).
 * - "promedio": todas las notas del periodo valen lo mismo.
 * - "ponderado": las notas se agrupan en partes (diario, examen…) y cada parte vale un porcentaje.
 * - Una nota sin valor (score = null) es una nota PENDIENTE: sirve para calcular cuánto se necesita.
 */
import type { GradeCategory, GradeItem, GradeMethod } from "./types";

export type Scale = { min: number; max: number; pass: number; decimals: number };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function roundTo(x: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
export function ceilTo(x: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.ceil(x * f - 1e-9) / f;
}
export function fmt(x: number | null | undefined, decimals: number) {
  return x == null ? "—" : x.toFixed(decimals);
}

/**
 * Nota de un periodo. Si `fill` tiene valor, las notas pendientes cuentan con ese valor;
 * si no, se ignoran (nota "actual").
 */
export function periodGrade(method: GradeMethod, cats: GradeCategory[], items: GradeItem[], fill?: number): number | null {
  const valued = items
    .map((i) => ({ ...i, v: i.score ?? fill }))
    .filter((i): i is GradeItem & { v: number } => typeof i.v === "number");
  if (!valued.length) return null;

  const weighted = cats.filter((c) => c.weight > 0);
  if (method === "promedio" || !weighted.length) return mean(valued.map((i) => i.v));

  let sum = 0;
  let totalWeight = 0;
  for (const c of weighted) {
    const avg = mean(valued.filter((i) => i.category_id === c.id).map((i) => i.v));
    if (avg == null) continue;
    sum += c.weight * avg;
    totalWeight += c.weight;
  }
  return totalWeight ? sum / totalWeight : null;
}

export type Needed =
  | { status: "sin-pendientes" }
  | { status: "asegurado" } // aunque saque la mínima, llega a la meta
  | { status: "necesita"; value: number } // necesita al menos `value` en cada pendiente
  | { status: "imposible"; best: number }; // ni con la máxima llega

/** Cuánto hay que sacar en CADA nota pendiente del periodo para llegar a la meta. */
export function neededOnPending(method: GradeMethod, cats: GradeCategory[], items: GradeItem[], target: number, scale: Scale): Needed {
  if (!items.some((i) => i.score == null)) return { status: "sin-pendientes" };
  const low = periodGrade(method, cats, items, scale.min);
  const high = periodGrade(method, cats, items, scale.max);
  if (low == null || high == null) return { status: "sin-pendientes" };
  if (low >= target - 1e-9) return { status: "asegurado" };
  if (high < target - 1e-9) return { status: "imposible", best: high };
  // La nota del periodo crece en línea recta con el valor de las pendientes.
  const x = scale.min + ((target - low) / (high - low)) * (scale.max - scale.min);
  return { status: "necesita", value: Math.min(scale.max, Math.max(scale.min, ceilTo(x, scale.decimals))) };
}

export type YearSummary = {
  average: number | null; // promedio de los periodos que ya tienen nota
  remaining: number; // periodos sin nota todavía
  needed: number | null; // promedio necesario en los periodos que faltan
  status: "aprobado" | "en-camino" | "en-riesgo" | "imposible" | "sin-datos" | "reprobado";
};

/** Resumen del año: promedio de los periodos y qué promedio hace falta en los que quedan. */
export function yearSummary(periodGrades: (number | null)[], target: number, scale: Scale): YearSummary {
  const known = periodGrades.filter((g): g is number => g != null);
  const remaining = periodGrades.length - known.length;
  const average = mean(known);
  if (!known.length) return { average: null, remaining, needed: target, status: "sin-datos" };

  if (remaining === 0) {
    return { average, remaining, needed: null, status: average! >= target - 1e-9 ? "aprobado" : "reprobado" };
  }
  const neededRaw = (target * periodGrades.length - known.reduce((a, b) => a + b, 0)) / remaining;
  const needed = ceilTo(Math.max(neededRaw, scale.min), scale.decimals);
  let status: YearSummary["status"];
  if (neededRaw > scale.max + 1e-9) status = "imposible";
  else if (average! >= target - 1e-9) status = "en-camino";
  else status = "en-riesgo";
  return { average, remaining, needed, status };
}
