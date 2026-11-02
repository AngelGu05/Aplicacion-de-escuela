"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { safeNext } from "@/lib/next-path";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña.", values };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Correo o contraseña incorrectos.", values };

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Esta cuenta no tiene acceso a la plataforma.", values };
  }
  if (profile.disabled) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Esta cuenta está suspendida. Habla con tu profesor.", values };
  }

  // Sesión única: este dispositivo pasa a ser el ÚNICO válido para la cuenta.
  const sid = randomUUID();
  await db
    .from("profiles")
    .update({ active_session_id: sid, last_login_at: new Date().toISOString() })
    .eq("id", profile.id);

  // Además, invalida en Supabase las sesiones de los demás dispositivos.
  await supabase.auth.signOut({ scope: "others" });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sid, sessionCookieOptions);

  redirect(safeNext(formData.get("next")) ?? (profile.role === "admin" ? "/admin" : "/"));
}

export async function logout() {
  const supabase = await createAuthClient();
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId && sid) {
    // Solo libera la sesión si este dispositivo era el activo.
    await createAdminClient()
      .from("profiles")
      .update({ active_session_id: null })
      .eq("id", userId)
      .eq("active_session_id", sid);
  }

  await supabase.auth.signOut({ scope: "local" });
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
