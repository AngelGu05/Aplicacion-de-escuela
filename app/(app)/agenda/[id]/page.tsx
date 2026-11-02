import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditEvent, EVENT_KINDS, SUBJECT_SUGGESTIONS } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgendaEvent, Classroom } from "@/lib/types";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EventForm } from "../EventForm";
import { deleteEvent } from "../actions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireUser();
  const db = createAdminClient();
  const [{ data: event }, { data: classrooms }] = await Promise.all([
    db.from("events").select("*").eq("id", id).maybeSingle<AgendaEvent>(),
    db.from("classrooms").select("id, name").order("name").returns<Classroom[]>(),
  ]);
  if (!event || !canEditEvent(profile, event)) notFound();

  const destinations = [{ value: "personal", label: "Solo para mí" }];
  if (profile.role === "admin") {
    destinations.push({ value: "salon:todos", label: "Todos los salones" });
    (classrooms ?? []).forEach((c) => destinations.push({ value: `salon:${c.id}`, label: `Salón ${c.name}` }));
  } else if (profile.can_edit_agenda && profile.classroom_id) {
    const name = classrooms?.find((c) => c.id === profile.classroom_id)?.name ?? "";
    destinations.push({ value: `salon:${profile.classroom_id}`, label: `Todo mi salón (${name})` });
  }
  const back = `/agenda?mes=${event.event_date.slice(0, 7)}&dia=${event.event_date}`;

  return (
    <main className="container narrow">
      <nav className="crumbs"><Link href={back}>Agenda</Link> <span>/</span> Editar</nav>
      <section className="card">
        <h1 className="h-card">Editar evento</h1>
        <EventForm event={event} defaultDate={event.event_date} destinations={destinations} kinds={EVENT_KINDS} subjects={SUBJECT_SUGGESTIONS} onCancelHref={back} />
      </section>
      <form action={deleteEvent} className="danger-zone">
        <input type="hidden" name="id" value={event.id} />
        {event.scope === "salon" && <p className="muted small">Este evento lo ven todos los del salón: si lo borras, desaparece para todos.</p>}
        <ConfirmButton message="¿Borrar este evento?" className="btn btn-danger btn-sm">Borrar evento</ConfirmButton>
      </form>
    </main>
  );
}
