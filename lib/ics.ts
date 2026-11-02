/** Genera archivos de calendario (.ics) que entienden iPhone, Android, Google y Outlook. */
import type { AgendaEvent } from "./types";

const KIND_LABEL: Record<string, string> = { examen: "Examen", tarea: "Tarea", proyecto: "Proyecto", actividad: "Actividad", otro: "Evento" };

function esc(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Las líneas de un .ics no deben pasar de 75 bytes: se cortan y continúan con un espacio. */
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > 74) {
      out.push(current);
      current = " " + ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n");
}

const compact = (iso: string) => iso.replace(/-/g, "");

function stamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function eventLines(e: AgendaEvent, host: string) {
  const kind = KIND_LABEL[e.kind] ?? "Evento";
  const summary = `${kind}${e.subject ? ` de ${e.subject}` : ""}: ${e.title}`;
  const lines = ["BEGIN:VEVENT", `UID:${e.id}@${host}`, `DTSTAMP:${stamp()}`, `SUMMARY:${esc(summary)}`];

  if (e.event_time) {
    const [h, m] = e.event_time.split(":");
    const start = `${compact(e.event_date)}T${h}${m}00`;
    const endH = String(Math.min(23, Number(h) + 1)).padStart(2, "0");
    lines.push(`DTSTART:${start}`, `DTEND:${compact(e.event_date)}T${endH}${m}00`);
  } else {
    const next = new Date(e.event_date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${compact(e.event_date)}`, `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`);
  }
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);

  // Recordatorio: N días antes (a las 7:00 a. m. si es de día completo; a la misma hora si tiene hora).
  const d = e.remind_days;
  let trigger: string;
  if (e.event_time) trigger = d > 0 ? `-P${d}D` : "-PT1H";
  else trigger = d > 0 ? `-PT${d * 24 - 7}H` : "PT7H";
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trigger}`, "END:VALARM");

  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(events: AgendaEvent[], host: string, name = "Agenda · Aula de Ciencias") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aula de Ciencias//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
    ...events.flatMap((e) => eventLines(e, host)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Enlace para agregar el evento a Google Calendar. */
export function googleCalendarUrl(e: AgendaEvent) {
  const kind = KIND_LABEL[e.kind] ?? "Evento";
  const text = `${kind}${e.subject ? ` de ${e.subject}` : ""}: ${e.title}`;
  let dates: string;
  if (e.event_time) {
    const [h, m] = e.event_time.split(":");
    const endH = String(Math.min(23, Number(h) + 1)).padStart(2, "0");
    dates = `${compact(e.event_date)}T${h}${m}00/${compact(e.event_date)}T${endH}${m}00`;
  } else {
    const next = new Date(e.event_date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    dates = `${compact(e.event_date)}/${compact(next.toISOString().slice(0, 10))}`;
  }
  const params = new URLSearchParams({ action: "TEMPLATE", text, dates, details: e.description ?? "" });
  return `https://calendar.google.com/calendar/render?${params}`;
}
