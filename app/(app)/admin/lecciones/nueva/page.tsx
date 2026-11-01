import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subject } from "@/lib/types";
import { LessonForm } from "../../LessonForm";

export default async function NewLessonPage() {
  const { data: subjects } = await createAdminClient().from("subjects").select("*").order("position").returns<Subject[]>();
  return (
    <>
      <nav className="crumbs"><Link href="/admin">Lecciones</Link> <span>/</span> Nueva</nav>
      <LessonForm subjects={subjects ?? []} />
    </>
  );
}
