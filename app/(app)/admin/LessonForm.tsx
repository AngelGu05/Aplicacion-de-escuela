"use client";

import { useActionState, useRef, useState } from "react";
import { saveLesson } from "./actions";
import type { FormState } from "@/app/login/actions";
import type { Lesson, Subject } from "@/lib/types";

export function LessonForm({ subjects, lesson }: { subjects: Subject[]; lesson?: Lesson }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLesson, undefined);
  const [kind, setKind] = useState(lesson?.kind ?? "interactiva");
  const [content, setContent] = useState(lesson?.content ?? "");
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [fileName, setFileName] = useState("");
  const [subjectId, setSubjectId] = useState(lesson?.subject_id ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [published, setPublished] = useState(lesson?.published ?? true);
  const [premium, setPremium] = useState(lesson?.is_premium ?? false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    if (!title) {
      const m = text.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (m?.[1]?.trim()) setTitle(m[1].trim());
    }
  }

  const sizeKb = Math.round(new Blob([content]).size / 1024);

  return (
    <form action={action} className="form form-wide">
      {lesson && <input type="hidden" name="id" value={lesson.id} />}

      <div className="form-row">
        <label className="field">
          <span>Materia</span>
          <select name="subject_id" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="" disabled>Elige…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <fieldset className="field">
          <span>Tipo</span>
          <div className="segmented">
            <label><input type="radio" name="kind" value="interactiva" checked={kind === "interactiva"} onChange={() => setKind("interactiva")} /> Lección interactiva (HTML)</label>
            <label><input type="radio" name="kind" value="aviso" checked={kind === "aviso"} onChange={() => setKind("aviso")} /> Aviso de texto</label>
          </div>
        </fieldset>
      </div>

      <label className="field">
        <span>Título</span>
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label className="field">
        <span>Descripción corta (opcional)</span>
        <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Se muestra en la lista de la materia" />
      </label>

      {kind === "interactiva" ? (
        <div className="field">
          <span>Archivo de la lección (.html)</span>
          <div className="upload">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Elegir archivo…</button>
            <span className="muted small">
              {fileName ? `${fileName} · ${sizeKb} KB` : content ? `HTML cargado · ${sizeKb} KB` : "Ningún archivo"}
            </span>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={onFile} />
          </div>
          <details>
            <summary className="small">O pegar el código HTML</summary>
            <textarea className="code" rows={10} value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
          </details>
          {sizeKb > 3800 && <p className="alert alert-error">El archivo pesa más de 3.8 MB. Reduce imágenes incrustadas.</p>}
        </div>
      ) : (
        <label className="field">
          <span>Texto del aviso</span>
          <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Los enlaces (https://…) se vuelven clicables." />
        </label>
      )}
      <input type="hidden" name="content" value={content} />

      <div className="checks">
        <label><input type="checkbox" name="published" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicada (visible para los alumnos)</label>
        <label><input type="checkbox" name="is_premium" checked={premium} onChange={(e) => setPremium(e.target.checked)} /> Premium (solo alumnos con acceso premium)</label>
      </div>

      {state?.error && <p className="alert alert-error">{state.error}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}
