import type { NextRequest } from "next/server";
import { getSessionState } from "@/lib/auth";
import { eventsFor } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCalendar } from "@/lib/ics";
import type { AgendaEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Descarga un solo evento como .ics (con su recordatorio) para agregarlo al calendario del teléfono. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = await getSessionState();
  if (state.status !== "ok") return new Response("Inicia sesión", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });

  const { data: e } = await createAdminClient().from("events").select("*").eq("id", id).maybeSingle<AgendaEvent>();
  if (!e) return new Response("No encontrado", { status: 404 });
  const visible = await eventsFor(state.profile, e.event_date, e.event_date, { includeHidden: true });
  if (!visible.some((v) => v.id === e.id)) return new Response("No encontrado", { status: 404 });

  const host = request.headers.get("host") ?? "aula";
  const safeName = e.title.normalize("NFD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "evento";
  return new Response(buildCalendar([e], host), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
