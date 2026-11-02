"use client";

import { useActionState, useState } from "react";
import { saveEvent } from "./actions";
import type { FormState } from "@/app/login/actions";
import type { AgendaEvent } from "@/lib/types";

type Kind = { value: string; label: string; icon: string };

export function EventForm({
  event, defaultDate, destinations, kinds, subjects, onCancelHref, initial,
}: {
  event?: AgendaEvent;
  initial?: { title?: string; kind?: string; subject?: string; date?: string };
  defaultDate: string;
  destinations: { value: string; label: string }[];
  kinds: readonly Kind[];
  subjects: string[];
  onCancelHref?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEvent, undefined);
  const initialDest = event ? (event.scope === "personal" ? "personal" : `salon:${event.classroom_id ?? "todos"}`) : "personal";
  const [kind, setKind] = useState<string>(event?.kind ?? (initial?.kind && kinds.some((k) => k.value === initial.kind) ? initial.kind : "tarea"));

  return (
    <form action={action} className="form event-form">
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="kind" value={kind} />

      <div className="kind-picker" role="radiogroup" aria-label="Tipo">
        {kinds.map((k) => (
          <button type="button" key={k.value} role="radio" aria-checked={kind === k.value}
            className={`kind-chip kind-${k.value} ${kind === k.value ? "is-on" : ""}`} onClick={() => setKind(k.value)}>
            <span aria-hidden>{k.icon}</span> {k.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Título</span>
        <input name="title" required maxLength={140} defaultValue={event?.title ?? initial?.title} placeholder="Ej. Examen del capítulo 3" />
      </label>

      <div className="form-row">
        <label className="field">
          <span>Materia (opcional)</span>
          <input name="subject" list="materias" defaultValue={event?.subject ?? initial?.subject ?? ""} placeholder="Ej. Física" />
          <datalist id="materias">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="field">
          <span>Fecha</span>
          <input name="event_date" type="date" required defaultValue={event?.event_date ?? initial?.date ?? defaultDate} />
        </label>
        <label className="field">
          <span>Hora (opcional)</span>
          <input name="event_time" type="time" defaultValue={event?.event_time?.slice(0, 5) ?? ""} />
        </label>
      </div>

      <label className="field">
        <span>Detalles (opcional)</span>
        <textarea name="description" rows={3} defaultValue={event?.description ?? ""} placeholder="Qué entra, qué hay que llevar, páginas…" />
      </label>

      <div className="form-row">
        <label className="field">
          <span>🔔 Recordarme</span>
          <select name="remind_days" defaultValue={String(event?.remind_days ?? 1)}>
            <option value="0">El mismo día</option>
            <option value="1">1 día antes</option>
            <option value="2">2 días antes</option>
            <option value="3">3 días antes</option>
            <option value="7">1 semana antes</option>
          </select>
        </label>
        {destinations.length > 1 && (
          <label className="field">
            <span>¿Para quién?</span>
            <select name="destino" defaultValue={initialDest}>
              {destinations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {state?.error && <p className="alert alert-error">{state.error}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : event ? "Guardar cambios" : "Agregar a la agenda"}</button>
        {onCancelHref && <a className="btn btn-ghost" href={onCancelHref}>Cancelar</a>}
      </div>
    </form>
  );
}
