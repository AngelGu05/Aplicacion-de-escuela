/**
 * Cálculo de notas. Funciones puras (sin base de datos), usadas en el servidor y en el simulador.
 *
 * - Una materia tiene notas por periodo (trimestre).
 * - "promedio": todas las notas del periodo valen lo mismo.
 * - "ponderado": las notas se agrupan en partes (Digitación, Apreciación, Bimestral) y cada parte vale un porcentaje.
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
/**
 * Decimales de los PROMEDIOS (nota final del año y promedios generales).
 * Como en el boletín de Seduca: las notas de cada bimestre van con 1 decimal,
 * pero los promedios finales van con 2 (cortados, no redondeados).
 */
export const finalDecimals = (scale: { decimals: number }) => Math.min(scale.decimals + 1, 3);

export function fmt(x: number | null | undefined, decimals: number) {
  return x == null ? "—" : x.toFixed(decimals);
}

/** Corta (no redondea) a N decimales, como hace Seduca: 3.95 → 3.9. */
export function truncTo(x: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.floor(x * f + 1e-9) / f;
}

/**
 * Nota de un periodo, calculada como en Seduca:
 * cada parte es el promedio de sus notas (cortado), y la nota del periodo es el promedio
 * ponderado de las partes que ya tienen notas (también cortado).
 * Si `fill` tiene valor, las notas pendientes cuentan con ese valor; si no, se ignoran.
 */
export function periodGrade(method: GradeMethod, cats: GradeCategory[], items: GradeItem[], fill?: number, decimals = 1): number | null {
  const valued = items
    .map((i) => ({ ...i, v: i.score ?? fill }))
    .filter((i): i is GradeItem & { v: number } => typeof i.v === "number");
  if (!valued.length) return null;

  const weighted = cats.filter((c) => c.weight > 0);
  if (method === "promedio" || !weighted.length) return truncTo(mean(valued.map((i) => i.v))!, decimals);

  let sum = 0;
  let totalWeight = 0;
  for (const c of weighted) {
    const avg = mean(valued.filter((i) => i.category_id === c.id).map((i) => i.v));
    if (avg == null) continue;
    sum += c.weight * truncTo(avg, decimals);
    totalWeight += c.weight;
  }
  return totalWeight ? truncTo(sum / totalWeight, decimals) : null;
}

export type Needed =
  | { status: "sin-pendientes" }
  | { status: "asegurado" } // aunque saque la mínima, llega a la meta
  | { status: "necesita"; value: number } // necesita al menos `value` en cada pendiente
  | { status: "imposible"; best: number }; // ni con la máxima llega

/** Cuánto hay que sacar en CADA nota pendiente del periodo para llegar a la meta. */
export function neededOnPending(method: GradeMethod, cats: GradeCategory[], items: GradeItem[], target: number, scale: Scale): Needed {
  if (!items.some((i) => i.score == null)) return { status: "sin-pendientes" };
  const f = (x: number) => periodGrade(method, cats, items, x, scale.decimals) ?? -Infinity;
  if (f(scale.min) >= target - 1e-9) return { status: "asegurado" };
  const best = f(scale.max);
  if (best < target - 1e-9) return { status: "imposible", best };
  // Busca la nota más baja que alcanza (con el corte de decimales la cuenta no es una línea recta).
  const step = 1 / 10 ** scale.decimals;
  for (let x = scale.min; x <= scale.max + 1e-9; x = roundTo(x + step, scale.decimals)) {
    if (f(x) >= target - 1e-9) return { status: "necesita", value: x };
  }
  return { status: "imposible", best };
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
  const average = known.length ? truncTo(mean(known)!, finalDecimals(scale)) : null;
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
