"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/login/actions";

const UUID = /^[0-9a-f-]{36}$/i;

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

// ---------------------------------------------------------------- Lecciones

function readLesson(formData: FormData) {
  const kind = str(formData, "kind") === "aviso" ? "aviso" : "interactiva";
  return {
    subject_id: str(formData, "subject_id"),
    title: str(formData, "title"),
    description: str(formData, "description") || null,
    kind,
    content: String(formData.get("content") ?? ""),
    is_premium: formData.get("is_premium") === "on",
    published: formData.get("published") === "on",
  } as const;
}

function validateLesson(l: ReturnType<typeof readLesson>): string | null {
  if (!UUID.test(l.subject_id)) return "Elige una materia.";
  if (!l.title) return "Escribe un título.";
  if (!l.content.trim()) return l.kind === "aviso" ? "Escribe el texto del aviso." : "Sube o pega el HTML de la lección.";
  return null;
}

export async function saveLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = str(formData, "id");
  const lesson = readLesson(formData);
  const problem = validateLesson(lesson);
  if (problem) return { error: problem };

  const db = createAdminClient();
  if (id) {
    if (!UUID.test(id)) return { error: "Lección no válida." };
    const { error } = await db
      .from("lessons")
      .update({ ...lesson, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: "No se pudo guardar: " + error.message };
  } else {
    const { error } = await db.from("lessons").insert(lesson);
    if (error) return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function toggleLessonFlag(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const flag = str(formData, "flag");
  if (!UUID.test(id) || (flag !== "is_premium" && flag !== "published")) return;
  const value = str(formData, "value") === "true";
  await createAdminClient().from("lessons").update({ [flag]: value }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteLesson(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  await createAdminClient().from("lessons").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/admin");
}

// ---------------------------------------------------------------- Alumnos

export async function createStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const toolsOnly = formData.get("tools_only") === "on";
  const subjectIds = formData.getAll("subject_access").map(String).filter((x) => UUID.test(x));
  const classroomRaw = String(formData.get("classroom_id") ?? "");
  const classroom_id = UUID.test(classroomRaw) ? classroomRaw : null;
  const values = { full_name: fullName, email, classroom_id: classroom_id ?? "" };
  if (!email) return { error: "Escribe el correo del alumno.", values };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", values };

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    const msg = error?.message?.toLowerCase().includes("already")
      ? "Ya existe una cuenta con ese correo."
      : error?.message ?? "No se pudo crear la cuenta.";
    return { error: msg, values };
  }

  const { error: profileError } = await db
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: fullName || null, role: "student", premium: false, classroom_id, ...(toolsOnly ? { lessons_enabled: false } : {}) });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id);
    return { error: "No se pudo guardar el perfil: " + profileError.message, values };
  }

  if (subjectIds.length) {
    await db.from("subject_access").insert(subjectIds.map((subject_id) => ({ user_id: data.user!.id, subject_id })));
  }
  revalidatePath("/admin/alumnos");
  return { ok: `Cuenta creada para ${email}. Pásale su correo y contraseña.` };
}

async function targetStudent(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!UUID.test(id) || id === admin.id) return null;
  return id;
}

export async function setStudentFlag(formData: FormData) {
  const id = await targetStudent(formData);
  const flag = str(formData, "flag");
  if (!id || !["disabled", "can_edit_agenda", "lessons_enabled"].includes(flag)) return;
  const value = str(formData, "value") === "true";
  const update: Record<string, unknown> = { [flag]: value };
  if (flag === "disabled" && value) update.active_session_id = null; // suspender = sacar ya
  await createAdminClient().from("profiles").update(update).eq("id", id);
  revalidatePath("/admin/alumnos");
}

export async function forceLogout(formData: FormData) {
  const id = await targetStudent(formData);
  if (!id) return;
  await createAdminClient().from("profiles").update({ active_session_id: null }).eq("id", id);
  revalidatePath("/admin/alumnos");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = await targetStudent(formData);
  if (!id) return { error: "Alumno no válido." };
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Mínimo 8 caracteres." };
  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };
  await db.from("profiles").update({ active_session_id: null }).eq("id", id);
  return { ok: "Contraseña cambiada." };
}

export async function deleteStudent(formData: FormData) {
  const id = await targetStudent(formData);
  if (!id) return;
  await createAdminClient().auth.admin.deleteUser(id); // el perfil se borra en cascada
  revalidatePath("/admin/alumnos");
}

// ---------------------------------------------------------------- Salones

export async function createClassroom(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(formData, "name").slice(0, 30);
  if (!name) return { error: "Escribe el nombre del salón (ej. 10°A)." };
  const { error } = await createAdminClient().from("classrooms").insert({ name });
  if (error) return { error: error.message.includes("duplicate") ? "Ya existe un salón con ese nombre." : error.message };
  revalidatePath("/admin/alumnos");
  return { ok: `Salón ${name} creado.` };
}

export async function deleteClassroom(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  await createAdminClient().from("classrooms").delete().eq("id", id);
  revalidatePath("/admin/alumnos");
}

export async function setStudentClassroom(formData: FormData) {
  const id = await targetStudent(formData);
  if (!id) return;
  const raw = str(formData, "classroom_id");
  await createAdminClient().from("profiles").update({ classroom_id: UUID.test(raw) ? raw : null }).eq("id", id);
  revalidatePath("/admin/alumnos");
}

// ---------------------------------------------------------------- Asistente

export async function deleteUnknown(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const db = createAdminClient();
  if (id === "todas") await db.from("assistant_unknown").delete().gte("count", 0);
  else if (UUID.test(id)) await db.from("assistant_unknown").delete().eq("id", id);
  revalidatePath("/admin/asistente");
}

// ---------------------------------------------------------------- Acceso Premium por materia

/** Da o quita el acceso Premium a una materia (o a todas), con vencimiento opcional. */
export async function setSubjectAccess(formData: FormData) {
  const id = await targetStudent(formData);
  if (!id) return;
  const subject = str(formData, "subject_id");
  const grant = str(formData, "grant") !== "false";
  const expiresRaw = str(formData, "expires_at");
  const expires_at = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null;
  const db = createAdminClient();

  let subjectIds: string[] = [];
  if (subject === "todas") {
    const { data } = await db.from("subjects").select("id").returns<{ id: string }[]>();
    subjectIds = (data ?? []).map((s) => s.id);
  } else if (UUID.test(subject)) subjectIds = [subject];
  if (!subjectIds.length) return;

  if (grant) {
    await db.from("subject_access").upsert(subjectIds.map((subject_id) => ({ user_id: id, subject_id, expires_at })));
  } else {
    await db.from("subject_access").delete().eq("user_id", id).in("subject_id", subjectIds);
  }
  revalidatePath("/admin/alumnos");
}

// ---------------------------------------------------------------- Respuestas que enseña el admin

export async function saveAnswer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = str(formData, "id");
  const question = str(formData, "question").slice(0, 200);
  const keywords = str(formData, "keywords").slice(0, 400);
  const answer = str(formData, "answer").slice(0, 1500);
  const room = str(formData, "classroom_id");
  const fromUnknown = str(formData, "from_unknown");
  if (!question) return { error: "Escribe la pregunta de ejemplo." };
  if (!answer) return { error: "Escribe la respuesta." };
  const row = { question, keywords, answer, classroom_id: UUID.test(room) ? room : null, updated_at: new Date().toISOString() };
  const db = createAdminClient();
  const { error } = UUID.test(id)
    ? await db.from("assistant_answers").update(row).eq("id", id)
    : await db.from("assistant_answers").insert(row);
  if (error) return { error: error.message.includes("does not exist") || error.code === "42P01" ? "Falta ejecutar supabase/007_respuestas_asistente.sql en Supabase." : error.message };
  if (UUID.test(fromUnknown)) await db.from("assistant_unknown").delete().eq("id", fromUnknown);
  revalidatePath("/admin/asistente");
  return { ok: "¡Listo! El asistente ya sabe responder eso." };
}

export async function deleteAnswer(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  await createAdminClient().from("assistant_answers").delete().eq("id", id);
  revalidatePath("/admin/asistente");
}
