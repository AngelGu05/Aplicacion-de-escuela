/**
 * Entiende fechas dichas en palabras: "hoy", "mañana", "el miércoles", "el 15",
 * "la próxima semana", "este finde", "de aquí al viernes", "en noviembre"…
 * Todo relativo a la fecha de hoy (YYYY-MM-DD, en la zona de la escuela).
 */
import { has } from "./texto";

export const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export type Range = { from: string; to: string; kind: "dia" | "rango"; label: string };

const d = (iso: string) => new Date(iso + "T12:00:00Z");
const iso = (x: Date) => x.toISOString().slice(0, 10);
export const plus = (s: string, n: number) => { const x = d(s); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
export const weekday = (s: string) => d(s).getUTCDay();
export const diffDays = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
const endOfMonth = (s: string) => { const x = d(s); return iso(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0, 12))); };

/** "martes 10 de noviembre" */
export function dateLong(s: string) {
  const x = d(s);
  const wd = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][x.getUTCDay()];
  return `${wd} ${x.getUTCDate()} de ${MONTHS[x.getUTCMonth()]}`;
}
export const weekdayName = (s: string) => ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][weekday(s)];

/** "hoy", "mañana", "pasado mañana", "el jueves 12", "el lunes 3 de diciembre" */
export function relLabel(s: string, today: string) {
  const n = diffDays(today, s);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === 2) return "pasado mañana";
  if (n === -1) return "ayer";
  const x = d(s), t = d(today);
  const sameMonth = x.getUTCMonth() === t.getUTCMonth();
  return `el ${weekdayName(s)} ${x.getUTCDate()}${sameMonth ? "" : ` de ${MONTHS[x.getUTCMonth()]}`}`;
}

/** Próximo día de la semana (hoy cuenta, salvo que se pida "próximo"). */
function nextWeekday(today: string, wd: number, skipToday: boolean) {
  let n = (wd - weekday(today) + 7) % 7;
  if (n === 0 && skipToday) n = 7;
  return plus(today, n);
}
/** Lunes de la semana siguiente. */
const nextMonday = (today: string) => plus(today, ((8 - weekday(today)) % 7) || 7);

/** Número de día ("el 15") → fecha: este mes si no ha pasado, si no el mes que viene. */
function dayNumber(today: string, day: number, month?: number) {
  const t = d(today);
  let y = t.getUTCFullYear(), m = month ?? t.getUTCMonth();
  let c = new Date(Date.UTC(y, m, day, 12));
  if (month == null && iso(c) < today) c = new Date(Date.UTC(y, m + 1, day, 12));
  if (month != null && iso(c) < plus(today, -60)) c = new Date(Date.UTC(y + 1, m, day, 12));
  if (c.getUTCDate() !== day) return null;
  return iso(c);
}

const one = (s: string, label?: string): Range => ({ from: s, to: s, kind: "dia", label: label ?? s });

/** Busca una fecha o un rango de fechas en la pregunta (ya normalizada). */
export function parseRange(q: string, today: string): Range | null {
  const s = q.replace(/\b(por|en|de) la manana\b/g, " ").replace(/\bpor la tarde\b/g, " ");
  const wdIdx = WEEKDAYS.findIndex((w) => has(s, w));

  // "15 de noviembre", "el 15", "el dia 15"
  const mDate = s.match(/\b(?:el |dia )?(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/);
  if (mDate) {
    const month = MONTHS.indexOf(mDate[2] === "setiembre" ? "septiembre" : mDate[2]);
    const r = dayNumber(today, Number(mDate[1]), month);
    if (r) return one(r);
  }

  // Rangos con palabras
  if (has(s, /\bproximas? dos semanas\b/, /\bproximas? 2 semanas\b/)) return { from: today, to: plus(today, 13), kind: "rango", label: "las próximas dos semanas" };
  if (has(s, /\bproximos? dias\b/)) return { from: today, to: plus(today, 6), kind: "rango", label: "los próximos días" };
  if (has(s, /\bfin de semana\b/)) {
    const sat = weekday(today) === 6 ? today : weekday(today) === 0 ? plus(today, -1) : nextWeekday(today, 6, false);
    return { from: sat < today ? today : sat, to: plus(sat, 1), kind: "rango", label: "este fin de semana" };
  }
  if (wdIdx >= 0 && has(s, /\b(de la )?(proxima|siguiente) semana\b/)) {
    const mon = nextMonday(today);
    return one(plus(mon, (wdIdx + 6) % 7));
  }
  if (has(s, /\b(proxima|siguiente) semana\b/)) {
    const mon = nextMonday(today);
    return { from: mon, to: plus(mon, 6), kind: "rango", label: "la próxima semana" };
  }
  if (has(s, /\besta semana\b/, /\bla semana\b/)) {
    const sun = plus(today, (7 - weekday(today)) % 7);
    return { from: today, to: sun, kind: "rango", label: "esta semana" };
  }
  if (has(s, /\b(fin|final) de mes\b/, /\beste mes\b/)) return { from: today, to: endOfMonth(today), kind: "rango", label: "este mes" };
  const mMonth = s.match(/\ben (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
  if (mMonth) {
    const m = MONTHS.indexOf(mMonth[1]);
    const t = d(today);
    let y = t.getUTCFullYear();
    if (m < t.getUTCMonth()) y++;
    const from = iso(new Date(Date.UTC(y, m, 1, 12)));
    return { from: from < today ? today : from, to: endOfMonth(from), kind: "rango", label: `en ${mMonth[1]}` };
  }
  if (wdIdx >= 0 && has(s, /\b(de aqui al?|hasta el|antes del)\b/)) {
    const end = nextWeekday(today, wdIdx, false);
    return { from: today, to: has(s, /\bantes del\b/) ? plus(end, -1) : end, kind: "rango", label: `de aquí al ${WEEKDAYS[wdIdx].replace("miercoles", "miércoles").replace("sabado", "sábado")}` };
  }

  // Días sueltos
  if (has(s, /\bpasado manana\b/)) return one(plus(today, 2));
  if (has(s, /\bmanana\b/)) return one(plus(today, 1));
  if (has(s, /\bhoy\b/)) return one(today);
  if (has(s, /\bayer\b/)) return one(plus(today, -1));
  if (wdIdx >= 0) return one(nextWeekday(today, wdIdx, has(s, /\b(proximo|siguiente)\b/)));
  const mNum = s.match(/\b(?:el|dia|del|al)\s+(\d{1,2})\b(?!\s*(?:\.\d|de (?:la|cada)))/);
  if (mNum && Number(mNum[1]) >= 1 && Number(mNum[1]) <= 31) {
    const r = dayNumber(today, Number(mNum[1]));
    if (r) return one(r);
  }
  return null;
}
