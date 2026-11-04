import { createAdminClient } from "../supabase/admin";
import { eventsFor } from "../agenda";
import { getPrefs, normCategory, normItem, normPrefs, normSubject, scaleOf, sortSubjects } from "../notas";
import { addDays, todayISO } from "../time";
import type { GradeCategory, GradeItem, GradeSubject, Profile } from "../types";
import type { Contexto } from "./motor";
import { parseKeywords, type Faq } from "./faq";

/** Junta las notas y la agenda de UN alumno para que el asistente pueda responder. */
export async function cargarContexto(profile: Profile): Promise<Contexto> {
  const db = createAdminClient();
  const today = todayISO();
  const prefs = normPrefs(await getPrefs(profile));
  const { data: subjRaw } = await db.from("grade_subjects").select("*").eq("user_id", profile.id).order("position").returns<GradeSubject[]>();
  const subjects = sortSubjects((subjRaw ?? []).map(normSubject));
  const ids = subjects.map((s) => s.id);
  const [{ data: cats }, { data: items }] = ids.length
    ? await Promise.all([
        db.from("grade_categories").select("*").in("subject_id", ids).order("position").returns<GradeCategory[]>(),
        db.from("grade_items").select("*").in("subject_id", ids).returns<GradeItem[]>(),
      ])
    : [{ data: [] as GradeCategory[] }, { data: [] as GradeItem[] }];
  const events = await eventsFor(profile, addDays(today, -30), addDays(today, 150));
  let faq: Faq[] = [];
  try {
    const { data } = await db.from("assistant_answers").select("id, question, keywords, answer, classroom_id")
      .returns<{ id: string; question: string; keywords: string; answer: string; classroom_id: string | null }[]>();
    faq = (data ?? [])
      .filter((r) => !r.classroom_id || r.classroom_id === profile.classroom_id || profile.role === "admin")
      .map((r) => ({ id: r.id, question: r.question, keywords: parseKeywords(r.keywords), answer: r.answer }));
  } catch { faq = []; }

  return {
    today,
    firstName: (profile.full_name ?? "").split(" ")[0] ?? "",
    scale: scaleOf(prefs),
    passMark: prefs.pass_mark,
    periods: prefs.periods,
    periodLabel: prefs.period_label,
    events,
    faq,
    subjects: subjects.map((s) => ({
      id: s.id, name: s.name, target: s.target, method: s.method,
      cats: (cats ?? []).filter((c) => c.subject_id === s.id).map(normCategory),
      items: (items ?? []).filter((i) => i.subject_id === s.id).map(normItem),
    })),
  };
}

/** Guarda una pregunta no entendida, SIN guardar quién la hizo. */
export async function registrarDesconocida(raw: string, normalized: string) {
  const db = createAdminClient();
  const key = normalized.slice(0, 200);
  if (!key) return;
  const { data } = await db.from("assistant_unknown").select("id, count").eq("normalized", key).maybeSingle<{ id: string; count: number }>();
  if (data) await db.from("assistant_unknown").update({ count: data.count + 1, last_at: new Date().toISOString() }).eq("id", data.id);
  else await db.from("assistant_unknown").insert({ normalized: key, example: raw.slice(0, 200) });
}
