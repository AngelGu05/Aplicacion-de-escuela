import type { NextRequest } from "next/server";
import { eventsFor } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCalendar } from "@/lib/ics";
import { addDays, todayISO } from "@/lib/time";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Calendario suscribible de un alumno (lo consulta su teléfono cada cierto tiempo).
 * Se identifica con un enlace secreto personal, porque los calendarios no pueden iniciar sesión.
 * Solo contiene la agenda (títulos y fechas), nunca notas ni lecciones.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(clean)) return new Response("No encontrado", { status: 404 });

  const { data: profile } = await createAdminClient().from("profiles").select("*").eq("calendar_token", clean).maybeSingle<Profile>();
  if (!profile || profile.disabled) return new Response("No encontrado", { status: 404 });

  const today = todayISO();
  const events = (await eventsFor(profile, addDays(today, -30), addDays(today, 365))).filter((e) => !e.done || e.event_date >= today);
  const host = request.headers.get("host") ?? "aula";
  return new Response(buildCalendar(events, host), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
