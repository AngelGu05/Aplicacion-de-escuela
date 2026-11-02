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
