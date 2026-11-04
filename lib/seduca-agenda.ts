/**
 * Eventos de la agenda de Seduca.
 * Seduca escribe cada evento así:  "Materia - Tipo - Título - [Parte]"
 *   ej. "Física - Prueba Bimestral - Prueba Bimestral - [Bimestral]"
 */
import type { EventKind } from "./types";

export type SeducaEventoCrudo = { t: string; d: string; h?: string | null };

export type SeducaEvento = {
  externalId: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  subject: string;
  tipo: string;
  title: string;
  parte: string | null; // Notas diarias / Apreciación / Bimestral
  kind: EventKind;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Qué tipo de evento es en la app, según el "Tipo" de Seduca. */
export function kindFromTipo(tipo: string, parte: string | null): EventKind {
  const t = norm(tipo);
  if (/bimestral|bimonthly|prueba|examen|quiz|parcial|ejercicio escrito|test|evaluacion/.test(t)) return "examen";
  if (/proyecto|project|feria|investigacion/.test(t)) return "proyecto";
  if (/charla|gira|acto|actividad|exposicion|presentacion|mural|decoracion/.test(t)) return "actividad";
  if (/tarea|trabajo|taller|redaccion|lamina|exercise|practica|progrentis|cuaderno|participacion|homework|assignment/.test(t)) return "tarea";
  if (parte && /bimestral/i.test(parte)) return "examen";
  return "tarea";
}

export function parseSeducaTitle(raw: string) {
  const clean = raw.replace(/^\s*\*\s*/, "").replace(/\s+/g, " ").trim();
  let parte: string | null = null;
  let rest = clean;
  const m = clean.match(/\s*-?\s*\[([^\]]+)\]\s*$/);
  if (m) { parte = m[1].trim(); rest = clean.slice(0, m.index).trim(); }
  const parts = rest.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const subject = parts[0] ?? "";
  const tipo = parts[1] ?? "";
  const title = (parts.slice(2).join(" - ") || tipo || subject).replace(/\s*-\s*$/, "").trim();
  return { subject, tipo, title, parte };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseSeducaEventos(raw: SeducaEventoCrudo[]): SeducaEvento[] {
  const seen = new Set<string>();
  const out: SeducaEvento[] = [];
  for (const e of raw) {
    if (!e || typeof e.t !== "string" || typeof e.d !== "string") continue;
    const date = e.d.slice(0, 10);
    if (!ISO.test(date) || !e.t.trim()) continue;
    const { subject, tipo, title, parte } = parseSeducaTitle(e.t);
    if (!subject) continue;
    const externalId = `${date}|${norm(e.t).slice(0, 160)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const time = e.h && /^\d{2}:\d{2}$/.test(e.h) && e.h !== "00:00" ? e.h : null;
    out.push({ externalId, date, time, subject, tipo, title, parte, kind: kindFromTipo(tipo, parte) });
  }
  return out.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}
