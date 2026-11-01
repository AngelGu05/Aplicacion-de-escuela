import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lesson, Subject } from "@/lib/types";
import { LessonForm } from "../../LessonForm";
import { deleteLesson } from "../../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: subjects }, { data: lesson }] = await Promise.all([
    db.from("subjects").select("*").order("position").returns<Subject[]>(),
    db.from("lessons").select("*").eq("id", id).maybeSingle<Lesson>(),
  ]);
  if (!lesson) notFound();

  return (
    <>
      <nav className="crumbs"><Link href="/admin">Lecciones</Link> <span>/</span> Editar</nav>
      <LessonForm subjects={subjects ?? []} lesson={lesson} />
      <form action={deleteLesson} className="danger-zone">
        <input type="hidden" name="id" value={lesson.id} />
        <p className="muted small">Borrar es permanente.</p>
        <ConfirmButton message="¿Borrar esta publicación? No se puede deshacer." className="btn btn-danger btn-sm">Borrar esta publicación</ConfirmButton>
      </form>
    </>
  );
}
