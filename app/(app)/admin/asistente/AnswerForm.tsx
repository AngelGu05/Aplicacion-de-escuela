"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAnswer } from "../actions";
import type { FormState } from "@/app/login/actions";

export type AnswerRow = { id: string; question: string; keywords: string; answer: string; classroom_id: string | null };

export function AnswerForm({ answer, rooms, preset, onDoneHref }: {
  answer?: AnswerRow;
  rooms: { id: string; name: string }[];
  preset?: { question: string; keywords: string; fromUnknown: string };
  onDoneHref?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAnswer, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !answer) {
      ref.current?.reset();
      if (onDoneHref) window.history.replaceState(null, "", onDoneHref);
    }
  }, [state, answer, onDoneHref]);
  return (
    <form ref={ref} action={action} className="form">
      {answer && <input type="hidden" name="id" value={answer.id} />}
      {preset && <input type="hidden" name="from_unknown" value={preset.fromUnknown} />}
      <div className="form-row">
        <label className="field">
          <span>Pregunta de ejemplo</span>
          <input name="question" required maxLength={200} defaultValue={answer?.question ?? preset?.question} placeholder="Ej. ¿Cuándo son las vacaciones?" />
        </label>
        <label className="field">
          <span>Para</span>
          <select name="classroom_id" defaultValue={answer?.classroom_id ?? ""}>
            <option value="">Todos los salones</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>Salón {r.name}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Palabras clave <small className="muted">(separadas por coma: las palabras que usarían para preguntarlo)</small></span>
        <input name="keywords" maxLength={400} defaultValue={answer?.keywords ?? preset?.keywords} placeholder="vacaciones, descanso, cuando salimos" />
      </label>
      <label className="field">
        <span>Respuesta del asistente</span>
        <textarea name="answer" required rows={3} maxLength={1500} defaultValue={answer?.answer} placeholder="Ej. ¡Xopá! Las vacaciones son del 20 de diciembre al 1 de marzo. 🏖️" />
      </label>
      {state?.error && <p className="alert alert-error">{state.error}</p>}
      {state?.ok && <p className="alert alert-info">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : answer ? "Guardar cambios" : "Enseñar esta respuesta"}</button>
    </form>
  );
}
