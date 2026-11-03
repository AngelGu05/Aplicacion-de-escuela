import { cache } from "react";
import { createAdminClient } from "./supabase/admin";
import { todayISO } from "./time";
import type { Profile } from "./types";

export type Grant = { subject_id: string; expires_at: string | null };

/** Accesos guardados de un alumno (incluye los vencidos, para mostrarlos en el panel). */
export const getGrants = cache(async (userId: string): Promise<Grant[] | null> => {
  const { data, error } = await createAdminClient()
    .from("subject_access").select("subject_id, expires_at").eq("user_id", userId).returns<Grant[]>();
  if (error) return null; // la tabla aún no existe (no se ejecutó 004_acceso_por_materia.sql)
  return data ?? [];
});

export const isActive = (g: Grant, today = todayISO()) => !g.expires_at || g.expires_at >= today;

/**
 * Materias Premium que puede ver un usuario: "all" para el administrador,
 * o el conjunto de materias con acceso vigente.
 */
export async function premiumAccess(profile: Profile): Promise<"all" | Set<string>> {
  if (profile.role === "admin") return "all";
  const grants = await getGrants(profile.id);
  if (grants === null) return profile.premium ? "all" : new Set(); // compatibilidad con el sistema anterior
  const today = todayISO();
  return new Set(grants.filter((g) => isActive(g, today)).map((g) => g.subject_id));
}

export const canSeePremium = (acc: "all" | Set<string>, subjectId: string) => acc === "all" || acc.has(subjectId);
