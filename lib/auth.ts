import { cache } from "react";
import { cookies, headers } from "next/headers";
import { PATH_HEADER, safeNext } from "./next-path";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { Profile } from "./types";

/** Cookie con el identificador de la sesión de ESTE dispositivo. */
export const SESSION_COOKIE = "aula_sid";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 días
};

export type SessionState =
  | { status: "ok"; profile: Profile }
  | { status: "anon" }
  | { status: "ended" } // la sesión de Supabase ya no existe pero el dispositivo tenía una (revocada o caducada)
  | { status: "replaced" } // alguien inició sesión con esta cuenta en otro dispositivo
  | { status: "disabled" } // cuenta suspendida
  | { status: "no-access" }; // existe en Auth pero no tiene perfil

/**
 * Comprueba quién está visitando y si su sesión sigue siendo la sesión activa de la cuenta.
 * Se ejecuta en CADA página y en CADA lección. `cache` evita repetir la consulta en la misma visita.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const cookieStore = await cookies();
  const deviceSid = cookieStore.get(SESSION_COOKIE)?.value;
  if (error || !userId) return deviceSid ? { status: "ended" } : { status: "anon" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!profile) return { status: "no-access" };
  if (profile.disabled) return { status: "disabled" };

  if (!deviceSid || deviceSid !== profile.active_session_id) return { status: "replaced" };

  return { status: "ok", profile };
});

const REASON_BY_STATUS: Record<Exclude<SessionState["status"], "ok">, string> = {
  anon: "",
  ended: "terminada",
  replaced: "otra-sesion",
  disabled: "suspendida",
  "no-access": "sin-acceso",
};

export function loginUrlFor(state: SessionState) {
  if (state.status === "ok") return "/";
  const reason = REASON_BY_STATUS[state.status];
  return reason ? `/login?motivo=${reason}` : "/login";
}

export async function requireUser(): Promise<Profile> {
  const state = await getSessionState();
  if (state.status !== "ok") {
    const next = safeNext((await headers()).get(PATH_HEADER));
    const url = loginUrlFor(state);
    redirect(next ? `${url}${url.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}` : url);
  }
  return state.profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/");
  return profile;
}

/** Puede ver contenido Premium. */
export function hasPremium(profile: Profile) {
  return profile.role === "admin" || profile.premium;
}
