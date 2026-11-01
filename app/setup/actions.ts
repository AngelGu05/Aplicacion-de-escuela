"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "../login/actions";

export async function adminExists() {
  const { count } = await createAdminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return (count ?? 0) > 0;
}

/** Crea la PRIMERA cuenta de administrador. Deja de funcionar en cuanto existe una. */
export async function createFirstAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await adminExists()) return { error: "Ya existe un administrador." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) return { error: "Escribe un correo y una contraseña de al menos 8 caracteres." };

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: error?.message ?? "No se pudo crear la cuenta." };

  const { error: profileError } = await db
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: fullName || null, role: "admin", premium: true });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id);
    return { error: "No se pudo guardar el perfil. ¿Ejecutaste supabase/schema.sql?" };
  }

  redirect("/login?motivo=creado");
}
