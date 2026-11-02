import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { EVENT_KINDS, eventsFor, kindInfo, SUBJECT_SUGGESTIONS } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, isISODate, longDate, monthName, todayISO } from "@/lib/time";
import type { Classroom, MyEvent } from "@/lib/types";
import { EventCard } from "./EventCard";
import { EventForm } from "./EventForm";
import { CopyLink } from "./CopyLink";
import { regenerateCalendarToken } from "./actions";

export const metadata = { title: "Agenda" };

const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(Date.UTC(year, month - 1, 1 - offset + i)).toISOString().slice(0, 10));
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string; ocultos?: string }> }) {
  const profile = await requireUser();
  const sp = await searchParams;
  const today = todayISO();

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const [year, month] = mes.split("-").map(Number);
  const grid = monthGrid(year, month);
  const selected = isISODate(sp.dia) ? sp.dia : mes === today.slice(0, 7) ? today : `${mes}-01`;
  const showHidden = sp.ocultos === "1";

  const prev = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);

  const db = createAdminClient();
  const [monthEvents, upcoming, { data: classrooms }] = await Promise.all([
    eventsFor(profile, grid[0], grid[grid.length - 1], { includeHidden: showHidden }),
    eventsFor(profile, today, addDays(today, 21)),
    db.from("classrooms").select("id, name").order("name").returns<Classroom[]>(),
  ]);
  const roomName = new Map((classrooms ?? []).map((c) => [c.id, c.name]));
  const byDay = new Map<string, MyEvent[]>();
  monthEvents.forEach((e) => byDay.set(e.event_date, [...(byDay.get(e.event_date) ?? []), e]));
  const dayEvents = byDay.get(selected) ?? [];
  const pendingSoon = upcoming.filter((e) => !e.done);
  const hiddenCount = monthEvents.filter((e) => e.hidden).length;

  // A dónde puede publicar este usuario
  const destinations = [{ value: "personal", label: "Solo para mí" }];
  if (profile.role === "admin") {
    destinations.push({ value: "salon:todos", label: "Todos los salones" });
    (classrooms ?? []).forEach((c) => destinations.push({ value: `salon:${c.id}`, label: `Salón ${c.name}` }));
  } else if (profile.can_edit_agenda && profile.classroom_id) {
    destinations.push({ value: `salon:${profile.classroom_id}`, label: `Todo mi salón (${roomName.get(profile.classroom_id) ?? ""})` });
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const feedPath = `${host}/api/agenda/feed/${profile.calendar_token}`;
  const myRoom = profile.classroom_id ? roomName.get(profile.classroom_id) : null;

  return (
    <main className="container">
      <section className="hero hero-sm">
        <span className="hero-kicker">{myRoom ? `Salón ${myRoom}` : "Mi agenda"}</span>
        <h1>Agenda 🗓️</h1>
        <p>Exámenes, tareas y proyectos de tu salón, más lo que tú agregues.</p>
      </section>

      <div className="agenda-layout">
        <section className="card calendar-card">
          <div className="cal-head">
            <Link className="btn btn-ghost btn-sm" href={`/agenda?mes=${prev}`} aria-label="Mes anterior">←</Link>
            <h2>{monthName(month)} {year}</h2>
            <Link className="btn btn-ghost btn-sm" href={`/agenda?mes=${next}`} aria-label="Mes siguiente">→</Link>
            <Link className="btn btn-sm" href="/agenda">Hoy</Link>
          </div>
          <div className="cal-grid" role="grid">
            {WEEK.map((d) => <div key={d} className="cal-wd" role="columnheader">{d}</div>)}
            {grid.map((d) => {
              const evs = byDay.get(d) ?? [];
              const out = d.slice(0, 7) !== mes;
              return (
                <Link key={d} role="gridcell" scroll={false}
                  href={`/agenda?mes=${mes}&dia=${d}${showHidden ? "&ocultos=1" : ""}`}
                  className={`cal-day ${out ? "is-out" : ""} ${d === today ? "is-today" : ""} ${d === selected ? "is-selected" : ""}`}
                  aria-label={`${longDate(d)}${evs.length ? `, ${evs.length} eventos` : ""}`}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  <span className="cal-evs">
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className={`cal-ev kind-${e.kind} ${e.done ? "is-done" : ""}`} title={e.title}>
                        <span className="cal-ev-dot" aria-hidden />
                        <span className="cal-ev-text">{kindInfo(e.kind).icon} {e.title}</span>
                      </span>
                    ))}
                    {evs.length > 3 && <span className="cal-more">+{evs.length - 3}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="cal-legend">
            {EVENT_KINDS.map((k) => <span key={k.value} className={`legend kind-${k.value}`}><i aria-hidden /> {k.label}</span>)}
            {hiddenCount > 0 && !showHidden && <Link href={`/agenda?mes=${mes}&dia=${selected}&ocultos=1`} className="small">Ver ocultos ({hiddenCount})</Link>}
            {showHidden && <Link href={`/agenda?mes=${mes}&dia=${selected}`} className="small">Esconder ocultos</Link>}
          </div>
        </section>

        <section className="day-panel">
          <h2 className="section-title">{longDate(selected)}</h2>
          {dayEvents.length ? (
            <div className="event-list">
              {dayEvents.map((e) => <EventCard key={e.id} e={e} today={today} classroomName={e.classroom_id ? roomName.get(e.classroom_id) : undefined} />)}
            </div>
          ) : (
            <p className="empty-sm">Nada para este día. 🎈</p>
          )}

          <details className="card add-event" open={!dayEvents.length && selected >= today}>
            <summary><span className="btn btn-primary btn-sm">+ Agregar evento</span></summary>
            <EventForm defaultDate={selected} destinations={destinations} kinds={EVENT_KINDS} subjects={SUBJECT_SUGGESTIONS} />
          </details>
        </section>
      </div>

      <section className="upcoming">
        <h2 className="section-title">🔔 Próximas 3 semanas {pendingSoon.length > 0 && <span className="count-pill">{pendingSoon.length}</span>}</h2>
        {pendingSoon.length ? (
          <div className="event-list">
            {pendingSoon.map((e) => (
              <Link key={e.id} href={`/agenda?mes=${e.event_date.slice(0, 7)}&dia=${e.event_date}`} className="event-link">
                <EventCard e={e} today={today} compact classroomName={e.classroom_id ? roomName.get(e.classroom_id) : undefined} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-sm">No tienes nada pendiente en las próximas 3 semanas. ✨</p>
        )}
      </section>

      <section className="card sync-card">
        <h2>📱 Recordatorios en tu celular</h2>
        <p className="muted">
          Suscribe el calendario de tu celular a tu agenda: los eventos nuevos aparecen solos y tu teléfono te avisa.
        </p>
        <div className="sync-actions">
          <a className="btn btn-primary" href={`webcal://${feedPath}`}>Suscribirme (iPhone / Mac)</a>
          <a className="btn" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://${feedPath}`)}`} target="_blank" rel="noopener noreferrer">
            Suscribirme (Google / Android)
          </a>
        </div>
        <details>
          <summary className="small">Ver o copiar el enlace</summary>
          <CopyLink url={`${proto}://${feedPath}`} />
          <p className="small muted">Este enlace es personal: no lo compartas. Si alguien lo tiene, puedes cambiarlo.</p>
          <form action={regenerateCalendarToken}><button className="btn btn-ghost btn-sm">Cambiar enlace</button></form>
        </details>
      </section>
    </main>
  );
}
