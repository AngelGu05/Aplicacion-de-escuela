import { createAdminClient } from "./supabase/admin";
import type { AgendaEvent, MyEvent, Profile } from "./types";

export const EVENT_KINDS = [
  { value: "examen", label: "Examen", icon: "📝" },
  { value: "tarea", label: "Tarea", icon: "📚" },
  { value: "proyecto", label: "Proyecto", icon: "🧪" },
  { value: "actividad", label: "Actividad", icon: "🎉" },
  { value: "otro", label: "Otro", icon: "📌" },
] as const;

export const kindInfo = (k: string) => EVENT_KINDS.find((x) => x.value === k) ?? EVENT_KINDS[4];

export const SUBJECT_SUGGESTIONS = [
  "Asistente de Laboratorio de Contabilidad", "Inglés", "Biología", "Consejería", "Contabilidad", "Educación Física",
  "Español", "Física", "Historia", "Informática", "Matemáticas", "Química", "Religión",
];

/** ¿Puede este usuario publicar eventos para un salón? */
export function canPublish(profile: Profile, classroomId: string | null) {
  if (profile.role === "admin") return true;
  return profile.can_edit_agenda && !!profile.classroom_id && classroomId === profile.classroom_id;
}

export function canEditEvent(profile: Profile, e: AgendaEvent) {
  if (e.scope === "personal") return e.owner_id === profile.id;
  return canPublish(profile, e.classroom_id);
}

/**
 * Eventos que ve un alumno entre dos fechas: los de su salón, los de "todos los salones"
 * y los suyos personales, con lo que él marcó (hecho / oculto).
 * El administrador ve también los de todos los salones.
 */
export async function eventsFor(profile: Profile, from: string, to: string, opts: { includeHidden?: boolean } = {}): Promise<MyEvent[]> {
  const db = createAdminClient();
  const base = () =>
    db.from("events").select("*").gte("event_date", from).lte("event_date", to).order("event_date").order("event_time", { nullsFirst: true });

  const queries = [base().eq("scope", "personal").eq("owner_id", profile.id)];
  if (profile.role === "admin") queries.push(base().eq("scope", "salon"));
  else {
    queries.push(base().eq("scope", "salon").is("classroom_id", null));
    if (profile.classroom_id) queries.push(base().eq("scope", "salon").eq("classroom_id", profile.classroom_id));
  }
  const results = await Promise.all(queries.map((q) => q.returns<AgendaEvent[]>()));
  const events = results.flatMap((r) => r.data ?? []);

  const { data: statuses } = await db
    .from("event_status")
    .select("event_id, done, hidden")
    .eq("user_id", profile.id)
    .returns<{ event_id: string; done: boolean; hidden: boolean }[]>();
  const byId = new Map((statuses ?? []).map((s) => [s.event_id, s]));

  return events
    .map((e) => ({ ...e, done: byId.get(e.id)?.done ?? false, hidden: byId.get(e.id)?.hidden ?? false, canEdit: canEditEvent(profile, e) }))
    .filter((e) => opts.includeHidden || !e.hidden)
    .sort((a, b) => (a.event_date + (a.event_time ?? "")).localeCompare(b.event_date + (b.event_time ?? "")));
}
