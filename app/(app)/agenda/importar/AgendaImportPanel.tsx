"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { importAgenda, type ImportAgendaState } from "../actions";
import { parseSeducaEventos, type SeducaEventoCrudo } from "@/lib/seduca-agenda";
import { readBookmarkletPayload } from "@/lib/bookmarklet";

const ICON: Record<string, string> = { examen: "📝", tarea: "📚", proyecto: "🧪", actividad: "🎉", otro: "📌" };
const dia = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function AgendaImportPanel({ destinations }: { destinations: { value: string; label: string }[] }) {
  const [raw, setRaw] = useState<SeducaEventoCrudo[] | null>(null);
  const [salon, setSalon] = useState("");
  const [state, action, pending] = useActionState<ImportAgendaState, FormData>(importAgenda, undefined);

  useEffect(() => {
    const data = readBookmarkletPayload();
    if (data?.tipo === "agenda" && Array.isArray(data.eventos)) {
      setRaw(data.eventos as SeducaEventoCrudo[]);
      setSalon(String(data.salon ?? ""));
      history.replaceState(null, "", window.location.pathname); // limpia la dirección
    } else setRaw([]);
  }, []);

  const evs = useMemo(() => (raw ? parseSeducaEventos(raw) : []), [raw]);

  if (raw === null) return <p className="muted">Cargando…</p>;

  if (state?.ok) {
    const o = state.ok;
    return (
      <div className="card import-done">
        <h2>✅ ¡Agenda actualizada!</h2>
        <p className="muted">
          {o.nuevos} nuevos · {o.actualizados} actualizados{o.borrados ? ` · ${o.borrados} quitados (ya no estaban en Seduca)` : ""}{o.omitidos ? ` · ${o.omitidos} ya estaban en tu salón` : ""}.
        </p>
        <Link href="/agenda" className="btn btn-primary">Ver mi agenda</Link>
      </div>
    );
  }

  if (!evs.length) {
    return (
      <section className="card">
        <h2 className="h-card">No llegaron eventos</h2>
        <p className="muted">Para traer tu agenda, entra a Seduca → <b>Calendario</b> y toca el botón <b>📥 Enviar a Aula</b> de tus favoritos.</p>
        <Link href="/conectar-seduca" className="btn btn-primary">¿Cómo instalo el botón?</Link>
      </section>
    );
  }

  const porDia = new Map<string, typeof evs>();
  evs.forEach((e) => porDia.set(e.date, [...(porDia.get(e.date) ?? []), e]));

  return (
    <form action={action} className="import-form">
      <section className="card">
        <h2 className="h-card">Llegaron {evs.length} eventos de Seduca{salon ? ` (${salon.replace(/^\*\s*/, "")})` : ""}</h2>
        <p className="small muted">Del {dia(evs[0].date)} al {dia(evs[evs.length - 1].date)}. Revisa y confirma abajo.</p>
        <div className="seduca-days">
          {[...porDia.entries()].map(([d, list]) => (
            <div key={d} className="seduca-day">
              <b>{dia(d)}</b>
              <ul>
                {list.map((e) => (
                  <li key={e.externalId} className={`kind-${e.kind}`}>
                    <span aria-hidden>{ICON[e.kind]}</span> <b>{e.subject}</b> · {e.tipo}{e.title && e.title !== e.tipo ? `: ${e.title}` : ""}
                    {e.parte && <span className="tag">{e.parte}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        {destinations.length > 1 ? (
          <label className="field">
            <span>¿Para quién?</span>
            <select name="destino" defaultValue={destinations[destinations.length - 1].value}>
              {destinations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
        ) : <input type="hidden" name="destino" value="personal" />}
        <p className="small muted">Si vuelves a importar, se <b>actualiza</b> sin duplicar. Lo que tú agregaste a mano no se toca.</p>
        <input type="hidden" name="eventos" value={JSON.stringify(raw)} />
        {state?.error && <p className="alert alert-error">{state.error}</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Importando…" : `Importar ${evs.length} eventos`}</button>
      </section>
    </form>
  );
}
