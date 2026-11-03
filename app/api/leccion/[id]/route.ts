import type { NextRequest } from "next/server";
import { getSessionState } from "@/lib/auth";
import { canSeePremium, premiumAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLessonDocument, simpleMessagePage } from "@/lib/protect";
import type { Lesson } from "@/lib/types";

export const dynamic = "force-dynamic";

const BASE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function page(status: number, title: string, message: string) {
  return new Response(simpleMessagePage(title, message), { status, headers: BASE_HEADERS });
}

/**
 * Entrega el contenido de UNA lección. Es el único lugar desde donde sale el contenido,
 * y solo lo entrega si: hay sesión, es la sesión activa de la cuenta, la lección está
 * publicada y el alumno tiene permiso (si es Premium).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Solo se puede ver incrustada dentro de la plataforma, no abriendo el enlace directo.
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "iframe") {
    return page(403, "Contenido protegido", "Esta lección solo se puede ver dentro de la plataforma.");
  }

  const state = await getSessionState();
  if (state.status !== "ok") {
    const msg =
      state.status === "replaced" || state.status === "ended"
        ? "Tu cuenta se abrió en otro dispositivo. Vuelve a iniciar sesión."
        : "Inicia sesión para ver esta lección.";
    return page(401, "Sesión no válida", msg);
  }
  const profile = state.profile;

  if (!/^[0-9a-f-]{36}$/i.test(id)) return page(404, "No encontrada", "Esta lección no existe.");

  const db = createAdminClient();
  const { data: lesson } = await db.from("lessons").select("*").eq("id", id).maybeSingle<Lesson>();

  if (!lesson || (!lesson.published && profile.role !== "admin")) {
    return page(404, "No encontrada", "Esta lección no existe o ya no está disponible.");
  }
  if (lesson.is_premium && !canSeePremium(await premiumAccess(profile), lesson.subject_id)) {
    return page(403, "Contenido Premium", "Esta lección es Premium y tu cuenta no tiene acceso a esta materia.");
  }

  if (profile.role !== "admin") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await db.from("access_logs").insert({
      user_id: profile.id,
      lesson_id: lesson.id,
      ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  }

  return new Response(buildLessonDocument(lesson, profile.email), { status: 200, headers: BASE_HEADERS });
}
