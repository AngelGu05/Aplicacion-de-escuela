import { createAdminClient } from "./supabase/admin";
import type { GradeCategory, GradeItem, GradePrefs, GradeSubject, Profile } from "./types";
import { periodGrade, yearSummary, type Scale } from "./grades";

export const DEFAULT_PREFS: Omit<GradePrefs, "user_id"> = {
  scale_min: 1, scale_max: 5, pass_mark: 3, decimals: 1, periods: 4, period_label: "Bimestre",
};

/** Materias del colegio (tal como aparecen en Seduca). */
export const COMMON_SUBJECTS: { name: string; color: string }[] = [
  { name: "Inglés", color: "#0891b2" },
  { name: "Biología", color: "#059669" },
  { name: "Contabilidad", color: "#4d7c0f" },
  { name: "Educación Física", color: "#ea580c" },
  { name: "Español", color: "#dc2626" },
  { name: "Física", color: "#2563eb" },
  { name: "Historia", color: "#b45309" },
  { name: "Informática", color: "#0284c7" },
  { name: "Matemáticas", color: "#7c3aed" },
  { name: "Química", color: "#d97706" },
  { name: "Religión", color: "#db2777" },
];

/**
 * Partes con las que el colegio calcula la nota (como en Seduca): tres partes que valen lo mismo.
 * Cada parte es el promedio de sus notas (cortado a 1 decimal) y la nota final es el promedio de las tres (cortado).
 */
export const DEFAULT_CATEGORIES = [
  { name: "Digitación", weight: 33.3333, position: 0 },
  { name: "Apreciación", weight: 33.3333, position: 1 },
  { name: "Bimestral", weight: 33.3333, position: 2 },
];

export const SUBJECT_COLORS = ["#2563eb", "#d97706", "#059669", "#7c3aed", "#dc2626", "#0891b2", "#db2777", "#65a30d", "#b45309", "#475569"];

export async function getPrefs(profile: Profile): Promise<GradePrefs> {
  const { data } = await createAdminClient().from("grade_prefs").select("*").eq("user_id", profile.id).maybeSingle<GradePrefs>();
  return data ?? { user_id: profile.id, ...DEFAULT_PREFS };
}

export const scaleOf = (p: GradePrefs): Scale => ({ min: Number(p.scale_min), max: Number(p.scale_max), pass: Number(p.pass_mark), decimals: p.decimals });

export const targetOf = (s: GradeSubject, p: GradePrefs) => (s.target != null ? Number(s.target) : Number(p.pass_mark));

/** Notas por periodo y resumen del año de una materia. */
export function subjectSummary(s: GradeSubject, cats: GradeCategory[], items: GradeItem[], prefs: GradePrefs) {
  const periods = Array.from({ length: prefs.periods }, (_, i) => i + 1);
  const grades = periods.map((p) => periodGrade(s.method, cats, items.filter((i) => i.period === p), undefined, prefs.decimals));
  const target = targetOf(s, prefs);
  return { grades, target, year: yearSummary(grades, target, scaleOf(prefs)) };
}

const num = (x: unknown) => (x == null ? null : Number(x));
export const normCategory = (c: GradeCategory): GradeCategory => ({ ...c, weight: Number(c.weight) });
export const normItem = (i: GradeItem): GradeItem => ({ ...i, score: num(i.score) });
export const normSubject = (s: GradeSubject): GradeSubject => ({ ...s, target: num(s.target) });
export const normPrefs = (p: GradePrefs): GradePrefs => ({
  ...p, scale_min: Number(p.scale_min), scale_max: Number(p.scale_max), pass_mark: Number(p.pass_mark),
});
