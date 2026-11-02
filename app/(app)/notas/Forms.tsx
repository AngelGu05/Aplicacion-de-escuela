"use client";

import { useActionState, useEffect, useRef } from "react";
import { addItem, addSubject, savePrefs, updateSubject } from "./actions";
import type { FormState } from "@/app/login/actions";
import type { GradeCategory, GradePrefs, GradeSubject } from "@/lib/types";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="alert alert-error">{state.error}</p>;
  if (state?.ok) return <p className="alert alert-info">{state.ok}</p>;
  return null;
}

export function PrefsForm({ prefs }: { prefs: GradePrefs }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePrefs, undefined);
  const presets = [
    { label: "1 a 5 (pasa con 3)", v: [1, 5, 3, 1] },
    { label: "0 a 100 (pasa con 70)", v: [0, 100, 70, 0] },
    { label: "1 a 10 (pasa con 6)", v: [1, 10, 6, 1] },
  ];
  const ref = useRef<HTMLFormElement>(null);
  const apply = (v: number[]) => {
    const f = ref.current!;
    (f.elements.namedItem("scale_min") as HTMLInputElement).value = String(v[0]);
    (f.elements.namedItem("scale_max") as HTMLInputElement).value = String(v[1]);
    (f.elements.namedItem("pass_mark") as HTMLInputElement).value = String(v[2]);
    (f.elements.namedItem("decimals") as HTMLSelectElement).value = String(v[3]);
  };
  return (
    <form ref={ref} action={action} className="form">
      <div className="preset-row">{presets.map((p) => <button key={p.label} type="button" className="btn btn-sm" onClick={() => apply(p.v)}>{p.label}</button>)}</div>
      <div className="form-row">
        <label className="field"><span>Nota mínima</span><input name="scale_min" inputMode="decimal" defaultValue={prefs.scale_min} /></label>
        <label className="field"><span>Nota máxima</span><input name="scale_max" inputMode="decimal" defaultValue={prefs.scale_max} /></label>
        <label className="field"><span>Para pasar</span><input name="pass_mark" inputMode="decimal" defaultValue={prefs.pass_mark} /></label>
      </div>
      <div className="form-row">
        <label className="field"><span>Decimales</span>
          <select name="decimals" defaultValue={String(prefs.decimals)}><option value="0">0</option><option value="1">1</option><option value="2">2</option></select>
        </label>
        <label className="field"><span>Periodos en el año</span>
          <select name="periods" defaultValue={String(prefs.periods)}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label className="field"><span>Se llaman</span><input name="period_label" defaultValue={prefs.period_label} placeholder="Trimestre" /></label>
      </div>
      <Msg state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function AddSubjectForm({ colors }: { colors: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSubject, undefined);
  return (
    <form action={action} className="form">
      <div className="form-row">
        <label className="field"><span>Materia</span><input name="name" required maxLength={50} placeholder="Ej. Matemáticas" /></label>
        <label className="field"><span>¿Cómo calcula tu profe?</span>
          <select name="method" defaultValue="promedio">
            <option value="promedio">Promedio simple (todas valen igual)</option>
            <option value="ponderado">Por partes con porcentaje (diario, examen…)</option>
          </select>
        </label>
      </div>
      <fieldset className="color-row">
        <legend className="small muted">Color</legend>
        {colors.map((c, i) => (
          <label key={c} className="color-dot" style={{ background: c }}>
            <input type="radio" name="color" value={c} defaultChecked={i === 0} aria-label={c} />
          </label>
        ))}
      </fieldset>
      <Msg state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creando…" : "Agregar materia"}</button>
    </form>
  );
}

export function SubjectSettingsForm({ subject, prefs, colors }: { subject: GradeSubject; prefs: GradePrefs; colors: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSubject, undefined);
  return (
    <form action={action} className="form">
      <input type="hidden" name="id" value={subject.id} />
      <div className="form-row">
        <label className="field"><span>Nombre</span><input name="name" defaultValue={subject.name} maxLength={50} /></label>
        <label className="field"><span>Mi meta (opcional)</span>
          <input name="target" inputMode="decimal" defaultValue={subject.target ?? ""} placeholder={`Para pasar: ${prefs.pass_mark}`} />
        </label>
        <label className="field"><span>Cálculo</span>
          <select name="method" defaultValue={subject.method}>
            <option value="promedio">Promedio simple</option>
            <option value="ponderado">Por partes con porcentaje</option>
          </select>
        </label>
      </div>
      <fieldset className="color-row">
        <legend className="small muted">Color</legend>
        {colors.map((c) => (
          <label key={c} className="color-dot" style={{ background: c }}>
            <input type="radio" name="color" value={c} defaultChecked={c === subject.color} aria-label={c} />
          </label>
        ))}
      </fieldset>
      <Msg state={state} />
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function AddItemForm({ subject, period, cats, prefs }: { subject: GradeSubject; period: number; cats: GradeCategory[]; prefs: GradePrefs }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addItem, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      const f = ref.current;
      if (f) {
        (f.elements.namedItem("name") as HTMLInputElement).value = "";
        (f.elements.namedItem("score") as HTMLInputElement).value = "";
      }
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="form add-item">
      <input type="hidden" name="subject_id" value={subject.id} />
      <input type="hidden" name="period" value={period} />
      <div className="add-item-row">
        <label className="field"><span>¿Qué fue?</span><input name="name" maxLength={60} placeholder="Ej. Prueba corta, Laboratorio…" /></label>
        {subject.method === "ponderado" && (
          <label className="field"><span>Parte</span>
            <select name="category_id" required defaultValue={cats[0]?.id}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </label>
        )}
        <label className="field score-field"><span>Nota</span>
          <input name="score" inputMode="decimal" placeholder="vacía = pendiente" aria-describedby="pending-help" />
        </label>
        <button className="btn btn-primary" disabled={pending}>{pending ? "…" : "Agregar"}</button>
      </div>
      <p id="pending-help" className="small muted">
        Deja la nota <b>vacía</b> para una evaluación que todavía no te dan (por ejemplo el examen trimestral): así te calculo cuánto necesitas.
      </p>
      <Msg state={state} />
    </form>
  );
}
