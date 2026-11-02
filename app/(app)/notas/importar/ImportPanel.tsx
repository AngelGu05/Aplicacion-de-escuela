"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { importGrades, type ImportState } from "../actions";
import { parseSeduca, normalizeName } from "@/lib/seduca";
import { fmt, periodGrade } from "@/lib/grades";

const CATS = ["d", "a", "b"].map((id, i) => ({ id, subject_id: "", name: id, weight: 1, position: i }));

export function ImportPanel({ periods, periodLabel, defaultPeriod, existing, decimals }: {
  periods: number; periodLabel: string; defaultPeriod: number; existing: string[]; decimals: number;
}) {
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState<ImportState, FormData>(importGrades, undefined);
  const parsed = useMemo(() => (text.trim() ? parseSeduca(text) : null), [text]);
  const known = useMemo(() => new Set(existing.map(normalizeName)), [existing]);

  if (state?.ok) {
    return (
      <div className="card import-done">
        <h2>✅ ¡Notas importadas!</h2>
        <p className="muted">
          {state.updated ? `${state.updated} materias actualizadas` : ""}{state.updated && state.created ? " y " : ""}{state.created ? `${state.created} materias nuevas` : ""}.
        </p>
        <Link href="/notas" className="btn btn-primary">Ver mis notas</Link>
      </div>
    );
  }

  const rows = parsed?.rows ?? [];
  return (
    <form action={action} className="import-form">
      <section className="card">
        <h2 className="h-card">1. Pega la tabla de Seduca</h2>
        <textarea
          className="paste-box" rows={7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"Pega aquí (Ctrl + V) la tabla de calificaciones que copiaste de Seduca…"}
          spellCheck={false}
        />
        {parsed?.problem && <p className="alert alert-error">{parsed.problem}</p>}
      </section>

      {rows.length > 0 && (
        <section className="card">
          <h2 className="h-card">2. Revisa que esté bien</h2>
          <div className="table-wrap">
            <table className="table import-table">
              <thead>
                <tr><th>Materia</th><th>Digitación</th><th>Apreciación</th><th>Bimestral</th><th>Final</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const items = [
                    ...r.digitacion.map((s) => ({ c: "d", s })), ...r.apreciacion.map((s) => ({ c: "a", s })), ...r.bimestral.map((s) => ({ c: "b", s })),
                  ].map(({ c, s }) => ({ id: "", subject_id: "", category_id: c, period: 1, name: "", score: s }));
                  const g = periodGrade("ponderado", CATS, items, undefined, decimals);
                  const match = r.seducaFinal == null || g === r.seducaFinal;
                  const cell = (xs: (number | null)[]) => xs.length ? xs.map((x, i) => <span key={i} className={`g-chip ${x == null ? "is-pending" : ""}`}>{x == null ? "–" : fmt(x, decimals)}</span>) : <span className="muted">—</span>;
                  return (
                    <tr key={r.name}>
                      <td><b>{r.name}</b>{!known.has(normalizeName(r.name)) && <span className="tag tag-new">nueva</span>}</td>
                      <td>{cell(r.digitacion)}</td>
                      <td>{cell(r.apreciacion)}</td>
                      <td>{cell(r.bimestral)}</td>
                      <td className="nowrap"><b>{fmt(g, decimals)}</b> {r.seducaFinal != null && <span title={match ? "Igual que en Seduca" : `Seduca dice ${r.seducaFinal}`} className={match ? "text-ok" : "text-error"}>{match ? "✓" : `≠ ${r.seducaFinal}`}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parsed && parsed.skipped.length > 0 && <p className="small muted">Sin notas (no se importan): {parsed.skipped.join(", ")}.</p>}
          <p className="small muted">✓ = el promedio que calcula tu página es igual al de Seduca. Los “–” se guardan como notas pendientes.</p>
        </section>
      )}

      {rows.length > 0 && (
        <section className="card">
          <h2 className="h-card">3. ¿De qué {periodLabel.toLowerCase()} son?</h2>
          <div className="form-row">
            <label className="field">
              <span>{periodLabel}</span>
              <select name="period" defaultValue={String(defaultPeriod)}>
                {Array.from({ length: periods }, (_, i) => <option key={i} value={i + 1}>{periodLabel} {i + 1}</option>)}
              </select>
            </label>
          </div>
          <label className="check"><input type="checkbox" name="pending_bimestral" defaultChecked /> Si una materia todavía no tiene bimestral, agregarlo como <b>pendiente</b> (para calcular cuánto necesito)</label>
          <input type="hidden" name="rows" value={JSON.stringify(rows.map(({ name, digitacion, apreciacion, bimestral }) => ({ name, digitacion, apreciacion, bimestral })))} />
          <p className="alert alert-info">Las notas de ese {periodLabel.toLowerCase()} en estas materias se <b>reemplazan</b> por las de Seduca. Las demás no se tocan.</p>
          {state?.error && <p className="alert alert-error">{state.error}</p>}
          <button className="btn btn-primary" disabled={pending}>{pending ? "Importando…" : `Importar ${rows.length} materias`}</button>
        </section>
      )}
    </form>
  );
}
