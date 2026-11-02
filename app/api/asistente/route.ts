import { getSessionState } from "@/lib/auth";
import { cargarContexto, registrarDesconocida } from "@/lib/asistente/contexto";
import { responder } from "@/lib/asistente/motor";
import { normalize } from "@/lib/asistente/texto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** El asistente: recibe una pregunta y responde con las notas y la agenda de quien pregunta. */
export async function POST(request: Request) {
  const state = await getSessionState();
  if (state.status !== "ok") return Response.json({ error: "Inicia sesión" }, { status: 401 });

  let q = "";
  try {
    q = String((await request.json())?.q ?? "").slice(0, 300);
  } catch {
    return Response.json({ error: "Pregunta no válida" }, { status: 400 });
  }

  const ctx = await cargarContexto(state.profile);
  const r = responder(q, ctx);

  // Acción "marcar como hecho": solo si el evento es de los que este alumno puede ver
  if (r.action?.type === "marcarHecho") {
    const id = r.action.eventId;
    if (ctx.events.some((e) => e.id === id)) {
      const ev = ctx.events.find((e) => e.id === id)!;
      await createAdminClient().from("event_status").upsert({ user_id: state.profile.id, event_id: id, done: true, hidden: ev.hidden });
    }
    r.action = undefined;
  }

  if (!r.understood) {
    try { await registrarDesconocida(q, normalize(q)); } catch { /* si la tabla aún no existe, no rompe */ }
  }
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
