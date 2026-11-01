import { cookies } from "next/headers";
import { getSessionState, loginUrlFor, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** El navegador pregunta cada cierto tiempo si su sesión sigue siendo la activa. */
export async function GET() {
  const state = await getSessionState();
  if (state.status !== "ok") (await cookies()).delete(SESSION_COOKIE); // limpia la sesión vieja de este dispositivo
  return Response.json(
    state.status === "ok" ? { ok: true } : { ok: false, redirect: loginUrlFor(state) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
