import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Classroom } from "@/lib/types";
import { AgendaImportPanel } from "./AgendaImportPanel";

export const metadata = { title: "Importar agenda de Seduca" };

export default async function AgendaImportPage() {
  const profile = await requireUser();
  const { data: classrooms } = await createAdminClient().from("classrooms").select("id, name").order("name").returns<Classroom[]>();
  const destinations = [{ value: "personal", label: "Solo para mí" }];
  if (profile.role === "admin") (classrooms ?? []).forEach((c) => destinations.push({ value: `salon:${c.id}`, label: `Todo el salón ${c.name}` }));
  else if (profile.can_edit_agenda && profile.classroom_id) {
    const name = classrooms?.find((c) => c.id === profile.classroom_id)?.name ?? "";
    destinations.push({ value: `salon:${profile.classroom_id}`, label: `Todo mi salón (${name})` });
  }
  return (
    <main className="container narrow">
      <nav className="crumbs"><Link href="/agenda">Agenda</Link> <span>/</span> Importar de Seduca</nav>
      <section className="hero hero-sm">
        <span className="hero-kicker">📥 Desde Seduca</span>
        <h1>Importar agenda</h1>
      </section>
      <AgendaImportPanel destinations={destinations} />
    </main>
  );
}
