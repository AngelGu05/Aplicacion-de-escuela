"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMMON_SUBJECTS, DEFAULT_CATEGORIES, getPrefs, normPrefs, seducaPosition } from "@/lib/notas";
import type { GradeSubject, Profile } from "@/lib/types";
import type { FormState } from "@/app/login/actions";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const numOrNull = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));
const isColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** La materia debe ser del usuario: nadie puede tocar las notas de otro. */
async function ownSubject(profile: Profile, id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("grade_subjects").select("*").eq("id", id).eq("user_id", profile.id).maybeSingle<GradeSubject>();
  return data;
}

function done(subjectId?: string) {
  revalidatePath("/notas");
  if (subjectId) revalidatePath(`/notas/${subjectId}`);
}

// ------------------------------------------------------------ Configuración

export async function savePrefs(_prev: FormState, f: FormData): Promise<FormState> {
  const profile = await requireUser();
  const min = numOrNull(str(f, "scale_min")), max = numOrNull(str(f, "scale_max")), pass = numOrNull(str(f, "pass_mark"));
  const decimals = Number(str(f, "decimals")), periods = Number(str(f, "periods"));
  const label = str(f, "period_label").slice(0, 20) || "Periodo";
  if (min == null || max == null || pass == null || [min, max, pass].some(Number.isNaN)) return { error: "Completa la escala." };
  if (!(min < max) || pass < min || pass > max) return { error: "La nota para pasar debe estar entre la mínima y la máxima." };
  if (![0, 1, 2].includes(decimals) || !(periods >= 1 && periods <= 6)) return { error: "Revisa decimales y periodos." };
  const { error } = await createAdminClient().from("grade_prefs").upsert({
    user_id: profile.id, scale_min: min, scale_max: max, pass_mark: pass, decimals, periods, period_label: label,
  });
  if (error) return { error: error.message };
  done();
  return { ok: "Guardado." };
}

// ------------------------------------------------------------ Materias

export async function addSubject(_prev: FormState, f: FormData): Promise<FormState> {
  const profile = await requireUser();
  const name = str(f, "name").slice(0, 50);
  const color = isColor(str(f, "color")) ? str(f, "color") : "#2563eb";
  const method = str(f, "method") === "ponderado" ? "ponderado" : "promedio";
  if (!name) return { error: "Escribe el nombre de la materia." };
  const db = createAdminClient();
  const { data, error } = await db.from("grade_subjects").insert({ user_id: profile.id, name, color, method }).select("id").single<{ id: string }>();
  if (error || !data) return { error: error?.message ?? "No se pudo crear." };
  if (method === "ponderado") {
    await db.from("grade_categories").insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, subject_id: data.id })));
  }
  done();
  redirect(`/notas/${data.id}`);
}

export async function addCommonSubjects() {
  const profile = await requireUser();
  const db = createAdminClient();
  const { data: existing } = await db.from("grade_subjects").select("name").eq("user_id", profile.id).returns<{ name: string }[]>();
  const have = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
  const rows = COMMON_SUBJECTS.map((s, i) => ({ user_id: profile.id, ...s, method: "ponderado", position: i }))
    .filter((s) => !have.has(s.name.toLowerCase()));
  if (!rows.length) { done(); return; }
  const { data: created } = await db.from("grade_subjects").insert(rows).select("id").returns<{ id: string }[]>();
  const cats = (created ?? []).flatMap((s) => DEFAULT_CATEGORIES.map((c) => ({ ...c, subject_id: s.id })));
  if (cats.length) await db.from("grade_categories").insert(cats);
  done();
}

export async function updateSubject(_prev: FormState, f: FormData): Promise<FormState> {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "id"));
  if (!s) return { error: "Materia no encontrada." };
  const prefs = normPrefs(await getPrefs(profile));
  const name = str(f, "name").slice(0, 50) || s.name;
  const color = isColor(str(f, "color")) ? str(f, "color") : s.color;
  const method = str(f, "method") === "ponderado" ? "ponderado" : "promedio";
  const target = numOrNull(str(f, "target"));
  if (target != null && (Number.isNaN(target) || target < prefs.scale_min || target > prefs.scale_max)) {
    return { error: `La meta debe estar entre ${prefs.scale_min} y ${prefs.scale_max}.` };
  }
  await createAdminClient().from("grade_subjects").update({ name, color, method, target }).eq("id", s.id);
  done(s.id);
  return { ok: "Guardado." };
}

export async function deleteSubject(f: FormData) {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "id"));
  if (!s) return;
  await createAdminClient().from("grade_subjects").delete().eq("id", s.id);
  done();
  redirect("/notas");
}

// ------------------------------------------------------------ Partes (ponderado)

export async function saveCategory(f: FormData) {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "subject_id"));
  if (!s) return;
  const id = str(f, "id");
  const name = str(f, "name").slice(0, 40);
  const weight = numOrNull(str(f, "weight"));
  if (!name || weight == null || Number.isNaN(weight) || weight < 0 || weight > 100) return;
  const db = createAdminClient();
  if (id && UUID.test(id)) await db.from("grade_categories").update({ name, weight }).eq("id", id).eq("subject_id", s.id);
  else await db.from("grade_categories").insert({ subject_id: s.id, name, weight, position: 99 });
  done(s.id);
}

export async function deleteCategory(f: FormData) {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "subject_id"));
  const id = str(f, "id");
  if (!s || !UUID.test(id)) return;
  await createAdminClient().from("grade_categories").delete().eq("id", id).eq("subject_id", s.id);
  done(s.id);
}

// ------------------------------------------------------------ Notas

export async function addItem(_prev: FormState, f: FormData): Promise<FormState> {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "subject_id"));
  if (!s) return { error: "Materia no encontrada." };
  const prefs = normPrefs(await getPrefs(profile));
  const period = Number(str(f, "period"));
  const name = str(f, "name").slice(0, 60);
  const score = numOrNull(str(f, "score"));
  const cat = str(f, "category_id");
  if (!(period >= 1 && period <= prefs.periods)) return { error: "Periodo no válido." };
  if (score != null && (Number.isNaN(score) || score < prefs.scale_min || score > prefs.scale_max)) {
    return { error: `La nota debe estar entre ${prefs.scale_min} y ${prefs.scale_max}.` };
  }
  if (s.method === "ponderado" && !UUID.test(cat)) return { error: "Elige a qué parte pertenece la nota." };
  await createAdminClient().from("grade_items").insert({
    subject_id: s.id, period, name, score, category_id: UUID.test(cat) ? cat : null,
  });
  done(s.id);
  return { ok: score == null ? "Nota pendiente agregada." : "Nota agregada." };
}

export async function updateItemScore(f: FormData) {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "subject_id"));
  const id = str(f, "id");
  if (!s || !UUID.test(id)) return;
  const prefs = normPrefs(await getPrefs(profile));
  const score = numOrNull(str(f, "score"));
  if (score != null && (Number.isNaN(score) || score < prefs.scale_min || score > prefs.scale_max)) return;
  await createAdminClient().from("grade_items").update({ score }).eq("id", id).eq("subject_id", s.id);
  done(s.id);
}

export async function deleteItem(f: FormData) {
  const profile = await requireUser();
  const s = await ownSubject(profile, str(f, "subject_id"));
  const id = str(f, "id");
  if (!s || !UUID.test(id)) return;
  await createAdminClient().from("grade_items").delete().eq("id", id).eq("subject_id", s.id);
  done(s.id);
}

// ------------------------------------------------------------ Importar desde Seduca

type ImportRow = { name: string; digitacion: (number | null)[]; apreciacion: (number | null)[]; bimestral: (number | null)[] };
export type ImportState = { error?: string; ok?: string; created?: number; updated?: number } | undefined;

const PARTS = [
  { key: "digitacion", name: "Digitación", label: "Digitación" },
  { key: "apreciacion", name: "Apreciación", label: "Apreciación" },
  { key: "bimestral", name: "Bimestral", label: "Bimestral" },
] as const;

export async function importGrades(_prev: ImportState, f: FormData): Promise<ImportState> {
  const profile = await requireUser();
  const prefs = normPrefs(await getPrefs(profile));
  const period = Number(str(f, "period"));
  const pendingBim = f.get("pending_bimestral") === "on";
  if (!(period >= 1 && period <= prefs.periods)) return { error: "Elige el periodo." };

  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(f.get("rows") ?? "[]"));
  } catch {
    return { error: "No se pudo leer la tabla." };
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 40) return { error: "No hay notas para importar." };
  const okScore = (x: unknown) => x === null || (typeof x === "number" && x >= prefs.scale_min && x <= prefs.scale_max);
  for (const r of rows) {
    if (typeof r.name !== "string" || !r.name.trim()) return { error: "Hay una materia sin nombre." };
    for (const p of PARTS) {
      if (!Array.isArray(r[p.key]) || r[p.key].length > 40 || !r[p.key].every(okScore)) {
        return { error: `Hay una nota fuera de la escala en ${r.name}.` };
      }
    }
  }

  const db = createAdminClient();
  const norm = (s: string) => s.replace(/^[*\s]+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const { data: mine } = await db.from("grade_subjects").select("*").eq("user_id", profile.id).returns<GradeSubject[]>();
  const byName = new Map((mine ?? []).map((s) => [norm(s.name), s]));
  let created = 0, updated = 0;

  for (const r of rows) {
    const name = r.name.replace(/^[*\s]+/, "").trim().slice(0, 50);
    let subject = byName.get(norm(name));
    if (!subject) {
      const color = COMMON_SUBJECTS.find((c) => norm(c.name) === norm(name))?.color ?? "#2563eb";
      const { data } = await db.from("grade_subjects")
        .insert({ user_id: profile.id, name, color, method: "ponderado", position: seducaPosition(name) })
        .select("*").single<GradeSubject>();
      if (!data) continue;
      subject = data;
      byName.set(norm(name), data);
      created++;
    } else {
      updated++;
      if (subject.method !== "ponderado") await db.from("grade_subjects").update({ method: "ponderado" }).eq("id", subject.id);
    }

    // Asegura las tres partes (Digitación, Apreciación, Bimestral)
    const { data: cats } = await db.from("grade_categories").select("id, name").eq("subject_id", subject.id).returns<{ id: string; name: string }[]>();
    const catId: Record<string, string> = {};
    for (const p of PARTS) {
      const found = (cats ?? []).find((c) => norm(c.name) === norm(p.name));
      if (found) catId[p.key] = found.id;
      else {
        const def = DEFAULT_CATEGORIES.find((c) => c.name === p.name)!;
        const { data } = await db.from("grade_categories").insert({ ...def, subject_id: subject.id }).select("id").single<{ id: string }>();
        if (data) catId[p.key] = data.id;
      }
    }

    // Reemplaza las notas de ese periodo por las de Seduca
    await db.from("grade_items").delete().eq("subject_id", subject.id).eq("period", period);
    const items = PARTS.flatMap((p) =>
      r[p.key].map((score, i) => ({
        subject_id: subject!.id, period, category_id: catId[p.key], score,
        name: p.key === "bimestral" ? "Bimestral" : `${p.label} ${i + 1}`,
      })),
    );
    if (pendingBim && !r.bimestral.length) {
      items.push({ subject_id: subject.id, period, category_id: catId.bimestral, score: null, name: "Bimestral" });
    }
    if (items.length) await db.from("grade_items").insert(items);
  }

  done();
  return { ok: "Notas importadas.", created, updated };
}
