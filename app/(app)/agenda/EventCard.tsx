import Link from "next/link";
import { kindInfo } from "@/lib/agenda";
import { googleCalendarUrl } from "@/lib/ics";
import { daysBetween, longDate, relativeDay, shortTime } from "@/lib/time";
import type { MyEvent } from "@/lib/types";
import { setEventStatus } from "./actions";

function StatusButton({ id, field, value, children, className }: { id: string; field: "done" | "hidden"; value: boolean; children: React.ReactNode; className?: string }) {
  return (
    <form action={setEventStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(value)} />
      <button className={className ?? "btn btn-ghost btn-sm"}>{children}</button>
    </form>
  );
}

export function EventCard({ e, today, classroomName, compact }: { e: MyEvent; today: string; classroomName?: string; compact?: boolean }) {
  const k = kindInfo(e.kind);
  const left = daysBetween(today, e.event_date);
  const reminder = !e.done && left >= 0 && left <= e.remind_days;
  const past = left < 0;

  return (
    <article className={`event-card kind-${e.kind} ${e.done ? "is-done" : ""} ${reminder ? "is-reminder" : ""} ${past ? "is-past" : ""}`}>
      <div className="event-side" aria-hidden>{k.icon}</div>
      <div className="event-main">
        <div className="event-meta">
          <span className={`tag tag-kind kind-${e.kind}`}>{k.label}</span>
          {e.subject && <span className="tag">{e.subject}</span>}
          <span className="tag tag-scope">{e.scope === "personal" ? "Personal" : classroomName ? `Salón ${classroomName}` : "Todos"}</span>
          {reminder && <span className="tag tag-bell">🔔 {relativeDay(e.event_date, today)}</span>}
        </div>
        <h3>{e.title}</h3>
        <p className="event-when">
          {compact ? `${relativeDay(e.event_date, today)} · ${longDate(e.event_date)}` : longDate(e.event_date)}
          {e.event_time && ` · ${shortTime(e.event_time)}`}
        </p>
        {!compact && e.description && <p className="event-desc">{e.description}</p>}
        {!compact && (
          <div className="event-actions">
            <StatusButton id={e.id} field="done" value={!e.done} className={`btn btn-sm ${e.done ? "" : "btn-primary"}`}>
              {e.done ? "↺ Desmarcar" : "✓ Hecho"}
            </StatusButton>
            <details className="add-cal">
              <summary className="btn btn-ghost btn-sm">📅 A mi calendario</summary>
              <div className="add-cal-panel">
                <a className="btn btn-sm" href={`/api/agenda/evento/${e.id}`}>iPhone / Outlook (.ics)</a>
                <a className="btn btn-sm" href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
              </div>
            </details>
            {e.canEdit && <Link className="btn btn-ghost btn-sm" href={`/agenda/${e.id}`}>Editar</Link>}
            {e.scope === "salon" && (
              <StatusButton id={e.id} field="hidden" value={!e.hidden}>{e.hidden ? "Mostrar" : "Ocultar"}</StatusButton>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
