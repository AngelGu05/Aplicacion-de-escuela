"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditEvent, canPublish, EVENT_KINDS } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { isISODate } from "@/lib/time";
import type { AgendaEvent } from "@/lib/types";
import type { FormState } from "@/app/login/actions";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireUser();
  const id = str(formData, "id");
  const title = str(formData, "title").slice(0, 140);
  const kind = str(formData, "kind");
  const subject = str(formData, "subject").slice(0, 60) || null;
  const date = str(formData, "event_date");
  const time = str(formData, "event_time");
  const description = str(formData, "description").slice(0, 2000) || null;
  const remind = Number(str(formData, "remind_days") || "1");
  const destino = str(formData, "destino") || "personal";

  if (!title) return { error: "Escribe un título." };
  if (!EVENT_KINDS.some((k) => k.value === kind)) return { error: "Elige el tipo." };
  if (!isISODate(date)) return { error: "Elige una fecha válida." };
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: "La hora no es válida." };
  if (!Number.isInteger(remind) || remind < 0 || remind > 14) return { error: "Recordatorio no válido." };

  let scope: "personal" | "salon" = "personal";
  let classroom_id: string | null = null;
  if (destino !== "personal") {
    scope = "salon";
    const target = destino.replace(/^salon:/, "");
    classroom_id = target === "todos" ? null : UUID.test(target) ? target : null;
    if (target !== "todos" && !classroom_id) return { error: "Salón no válido." };
    if (!canPublish(profile, classroom_id)) return { error: "No tienes permiso para publicar en ese salón." };
  }

  const row = {
    title, kind, subject, description, remind_days: remind, scope, classroom_id,
    event_date: date, event_time: time ? `${time}:00` : null, updated_at: new Date().toISOString(),
  };

  const db = createAdminClient();
  if (id) {
    if (!UUID.test(id)) return { error: "Evento no válido." };
    const { data: existing } = await db.from("events").select("*").eq("id", id).maybeSingle<AgendaEvent>();
    if (!existing || !canEditEvent(profile, existing)) return { error: "No puedes editar este evento." };
    const { error } = await db.from("events").update(row).eq("id", id);
    if (error) return { error: "No se pudo guardar: " + error.message };
  } else {
    const { error } = await db.from("events").insert({ ...row, owner_id: profile.id });
    if (error) return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/agenda?mes=${date.slice(0, 7)}&dia=${date}`);
}

export async function deleteEvent(formData: FormData) {
  const profile = await requireUser();
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  const db = createAdminClient();
  const { data: existing } = await db.from("events").select("*").eq("id", id).maybeSingle<AgendaEvent>();
  if (!existing || !canEditEvent(profile, existing)) return;
  await db.from("events").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/agenda?mes=${existing.event_date.slice(0, 7)}&dia=${existing.event_date}`);
}

/** Marcar como hecho u ocultar: solo cambia la agenda de quien lo hace. */
export async function setEventStatus(formData: FormData) {
  const profile = await requireUser();
  const id = str(formData, "id");
  const field = str(formData, "field");
  if (!UUID.test(id) || (field !== "done" && field !== "hidden")) return;
  const value = str(formData, "value") === "true";
  const db = createAdminClient();
  const { data: current } = await db
    .from("event_status").select("done, hidden").eq("user_id", profile.id).eq("event_id", id)
    .maybeSingle<{ done: boolean; hidden: boolean }>();
  await db.from("event_status").upsert({
    user_id: profile.id, event_id: id,
    done: field === "done" ? value : current?.done ?? false,
    hidden: field === "hidden" ? value : current?.hidden ?? false,
  });
  revalidatePath("/", "layout");
}

/** Crea un enlace nuevo para el calendario del celular (el anterior deja de funcionar). */
export async function regenerateCalendarToken() {
  const profile = await requireUser();
  await createAdminClient().from("profiles").update({ calendar_token: randomUUID() }).eq("id", profile.id);
  revalidatePath("/agenda");
}

// ------------------------------------------------------------ Importar desde Seduca

export type ImportAgendaState = { error?: string; ok?: { nuevos: number; actualizados: number; borrados: number; omitidos: number } } | undefined;

/**
 * Guarda los eventos que trajo el botón de Seduca.
 * Volver a importar NO duplica: actualiza los que ya estaban, agrega los nuevos y borra
 * los que Seduca ya no tiene (solo entre las fechas importadas y solo eventos que vinieron de Seduca).
 */
export async function importAgenda(_prev: ImportAgendaState, f: FormData): Promise<ImportAgendaState> {
  const profile = await requireUser();
  const { parseSeducaEventos } = await import("@/lib/seduca-agenda");
  let raw: unknown;
  try { raw = JSON.parse(String(f.get("eventos") ?? "[]")); } catch { return { error: "No se pudo leer la agenda." }; }
  if (!Array.isArray(raw) || raw.length > 600) return { error: "La agenda está vacía o es demasiado grande." };
  const evs = parseSeducaEventos(raw as never[]);
  if (!evs.length) return { error: "No encontré eventos válidos." };

  const destino = str(f, "destino") || "personal";
  let scope: "personal" | "salon" = "personal";
  let classroom_id: string | null = null;
  if (destino !== "personal") {
    scope = "salon";
    const target = destino.replace(/^salon:/, "");
    classroom_id = UUID.test(target) ? target : null;
    if (!classroom_id || !canPublish(profile, classroom_id)) return { error: "No tienes permiso para publicar en ese salón." };
  }

  const db = createAdminClient();
  const from = evs[0].date, to = evs[evs.length - 1].date;
  let q = db.from("events").select("*").eq("source", "seduca").gte("event_date", from).lte("event_date", to);
  q = scope === "personal" ? q.eq("scope", "personal").eq("owner_id", profile.id) : q.eq("scope", "salon").eq("classroom_id", classroom_id!);
  const { data: existing, error } = await q.returns<(AgendaEvent & { external_id: string | null })[]>();
  if (error) return { error: "Falta preparar la base de datos: ejecuta supabase/006_agenda_seduca.sql en Supabase." };

  // Si es para uno mismo, no repetir lo que su salón ya tiene publicado desde Seduca
  let yaEnSalon = new Set<string>();
  if (scope === "personal" && profile.classroom_id) {
    const { data } = await db.from("events").select("external_id").eq("scope", "salon").eq("classroom_id", profile.classroom_id)
      .eq("source", "seduca").gte("event_date", from).lte("event_date", to).returns<{ external_id: string | null }[]>();
    yaEnSalon = new Set((data ?? []).map((x) => x.external_id ?? ""));
  }

  const byExt = new Map((existing ?? []).map((e) => [e.external_id ?? "", e]));
  const nuevosIds = new Set<string>();
  let nuevos = 0, actualizados = 0, omitidos = 0;
  const inserts: Record<string, unknown>[] = [];
  for (const e of evs) {
    if (yaEnSalon.has(e.externalId)) { omitidos++; continue; }
    nuevosIds.add(e.externalId);
    const row = {
      title: (e.title && e.title !== e.tipo ? `${e.tipo}: ${e.title}` : e.tipo || e.title).slice(0, 140),
      kind: e.kind, subject: e.subject.slice(0, 60), event_date: e.date, event_time: e.time ? `${e.time}:00` : null,
      description: [e.parte ? `Parte: ${e.parte}` : null, "Importado de Seduca"].filter(Boolean).join(" · "),
      updated_at: new Date().toISOString(),
    };
    const old = byExt.get(e.externalId);
    if (old) { await db.from("events").update(row).eq("id", old.id); actualizados++; }
    else { inserts.push({ ...row, scope, classroom_id, owner_id: profile.id, remind_days: e.kind === "examen" ? 2 : 1, source: "seduca", external_id: e.externalId }); nuevos++; }
  }
  if (inserts.length) {
    const { error: insErr } = await db.from("events").insert(inserts);
    if (insErr) return { error: "No se pudo guardar: " + insErr.message };
  }
  const aBorrar = (existing ?? []).filter((e) => !nuevosIds.has(e.external_id ?? "") && !yaEnSalon.has(e.external_id ?? "")).map((e) => e.id);
  if (aBorrar.length) await db.from("events").delete().in("id", aBorrar);

  revalidatePath("/", "layout");
  return { ok: { nuevos, actualizados, borrados: aBorrar.length, omitidos } };
}
