/**
 * Cerebro del asistente (sin inteligencia artificial de pago).
 * Recibe la pregunta y los datos del alumno (notas + agenda) y devuelve la respuesta.
 * Es una función pura: no toca la base de datos, así que se puede probar fácilmente.
 */
import { finalDecimals, fmt, neededOnPending, periodGrade, yearSummary, type Scale } from "../grades";
import type { GradeCategory, GradeItem, GradeMethod, MyEvent } from "../types";
import { dateLong, diffDays, parseRange, plus, relLabel, weekdayName, WEEKDAYS, type Range } from "./fechas";
import { has, normalize, speaksPana, stripAccents, SUBJECT_ALIASES } from "./texto";
import { esGroseria, matchFaq, type Faq } from "./faq";

// ---------------------------------------------------------------- Datos de entrada

export type SubjectData = {
  id: string;
  name: string;
  target: number | null;
  method: GradeMethod;
  cats: GradeCategory[];
  items: GradeItem[];
};

export type Contexto = {
  today: string;
  firstName: string;
  scale: Scale;
  passMark: number;
  periods: number;
  periodLabel: string;
  subjects: SubjectData[];
  events: MyEvent[]; // desde hace ~30 días hasta ~120 días
  faq?: Faq[]; // respuestas enseñadas por el administrador
};

export type Accion =
  | { type: "abrir"; href: string; label: string }
  | { type: "tour" }
  | { type: "marcarHecho"; eventId: string };

export type Respuesta = { text: string; understood: boolean; links?: { href: string; label: string }[]; action?: Accion };

// ---------------------------------------------------------------- Tono

type Tono = { pana: boolean };
const pick = (t: Tono, pana: string, formal: string) => (t.pana ? pana : formal);
const hola = (t: Tono, name: string) => pick(t, `¡Xopá${name ? `, ${name}` : ""}! 👋 `, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinY = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

// ---------------------------------------------------------------- Materias

const nk = (s: string) => stripAccents(s.toLowerCase()).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Busca la materia mencionada (por nombre o apodo). Prefiere la coincidencia más larga ("educación física" antes que "física"). */
export function findSubject(q: string, subjects: SubjectData[]): SubjectData | null {
  let best: { s: SubjectData; len: number } | null = null;
  for (const s of subjects) {
    const key = nk(s.name);
    const aliases = new Set([key, ...(SUBJECT_ALIASES[key] ?? [])]);
    for (const a of aliases) {
      const re = new RegExp(`\\b${a.replace(/\./g, "\\.?")}\\b`);
      if (re.test(q) && (!best || a.length > best.len)) best = { s, len: a.length };
    }
  }
  return best?.s ?? null;
}

/** La materia de un evento (texto libre) → materia del alumno. */
const subjectOfEvent = (e: MyEvent, subjects: SubjectData[]) => (e.subject ? findSubject(nk(e.subject), subjects) : null);

type Estado = {
  s: SubjectData;
  period: number;
  grade: number | null; // nota del periodo actual
  target: number;
  needPass: ReturnType<typeof neededOnPending>;
  needTarget: ReturnType<typeof neededOnPending>;
  pendingName: string; // "el bimestral", "tus notas pendientes"
  year: ReturnType<typeof yearSummary>;
};

/** Cómo va el alumno en una materia, incluyendo cuánto necesita. */
function estado(s: SubjectData, ctx: Contexto): Estado {
  const period = Math.max(1, ...s.items.map((i) => i.period));
  let items = s.items.filter((i) => i.period === period);
  let pendingName = "tus notas pendientes";
  const pend = items.filter((i) => i.score == null);
  if (pend.length === 1) pendingName = /bimestral/i.test(pend[0].name) || /bimestral/i.test(s.cats.find((c) => c.id === pend[0].category_id)?.name ?? "") ? "el bimestral" : `“${pend[0].name || "la nota pendiente"}”`;
  // Si no hay pendientes pero la parte "Bimestral" está vacía, se supone que falta el bimestral.
  if (!pend.length && s.method === "ponderado") {
    const bim = s.cats.find((c) => /bimestral|examen/i.test(c.name)) ?? s.cats[s.cats.length - 1];
    if (bim && !items.some((i) => i.category_id === bim.id)) {
      items = [...items, { id: "virtual", subject_id: s.id, category_id: bim.id, period, name: "Bimestral", score: null }];
      pendingName = "el bimestral";
    }
  }
  const target = s.target ?? ctx.passMark;
  const grades = Array.from({ length: ctx.periods }, (_, i) => periodGrade(s.method, s.cats, s.items.filter((x) => x.period === i + 1), undefined, ctx.scale.decimals));
  return {
    s, period, target, pendingName,
    grade: periodGrade(s.method, s.cats, s.items.filter((i) => i.period === period), undefined, ctx.scale.decimals),
    needPass: neededOnPending(s.method, s.cats, items, ctx.passMark, ctx.scale),
    needTarget: neededOnPending(s.method, s.cats, items, target, ctx.scale),
    year: yearSummary(grades, ctx.passMark, ctx.scale),
  };
}

const f = (x: number | null | undefined, ctx: Contexto) => fmt(x, ctx.scale.decimals);
/** Promedios (finales y generales) con 2 decimales, como el boletín. */
const f2 = (x: number | null | undefined, ctx: Contexto) => fmt(x, finalDecimals(ctx.scale));

/** "para pasar necesitas al menos 2.8 en el bimestral" (sin punto final). */
function needText(e: Estado, ctx: Contexto, t: Tono, goal: number = ctx.passMark, opts: { prefijo?: boolean; materia?: boolean } = {}): string {
  const { prefijo = true, materia = false } = opts;
  const n = goal === ctx.passMark ? e.needPass : neededOnPending(e.s.method, e.s.cats, withVirtual(e), goal, ctx.scale);
  const meta = goal === ctx.passMark ? pick(t, "pa' pasar", "para pasar") : pick(t, `pa' quedar con ${f(goal, ctx)}`, `para quedar con ${f(goal, ctx)}`);
  const donde = `${e.pendingName}${materia ? ` de ${e.s.name}` : ""}`;
  switch (n.status) {
    case "asegurado": return goal === ctx.passMark
      ? pick(t, `ya tienes ${materia ? e.s.name : "la materia"} asegurada: pasas aunque saques la mínima`, `ya tienes ${materia ? e.s.name : "la materia"} asegurada: apruebas aunque saques la nota mínima`)
      : pick(t, `ya tienes asegurado el ${f(goal, ctx)}`, `ya tienes asegurado el ${f(goal, ctx)}`);
    case "necesita": return `${prefijo ? `${meta} ` : ""}necesitas al menos **${f(n.value, ctx)}** en ${donde}`;
    case "imposible": return pick(t, `ayala, aunque saques ${f(ctx.scale.max, ctx)} en ${donde} te quedaría en **${f(n.best, ctx)}**`, `aunque saques ${f(ctx.scale.max, ctx)} en ${donde}, quedarías en **${f(n.best, ctx)}**`);
    default: return pick(t, "todavía no tienes notas pendientes pa' calcular", "aún no hay notas pendientes para calcular");
  }
}
function withVirtual(e: Estado): GradeItem[] {
  const items = e.s.items.filter((i) => i.period === e.period);
  if (items.some((i) => i.score == null) || e.s.method !== "ponderado") return items;
  const bim = e.s.cats.find((c) => /bimestral|examen/i.test(c.name)) ?? e.s.cats[e.s.cats.length - 1];
  if (bim && !items.some((i) => i.category_id === bim.id)) return [...items, { id: "virtual", subject_id: e.s.id, category_id: bim.id, period: e.period, name: "Bimestral", score: null }];
  return items;
}

function nivel(g: number | null, ctx: Contexto) {
  if (g == null) return "sin-notas";
  if (g < ctx.passMark) return "critico";
  if (g < 4) return "reforzar";
  if (g < 4.5) return "bien";
  return "muy-bien";
}

// ---------------------------------------------------------------- Eventos

const KIND: Record<string, { label: string; peso: number }> = {
  examen: { label: "examen", peso: 3 }, proyecto: { label: "proyecto", peso: 2 }, tarea: { label: "tarea", peso: 1.2 },
  actividad: { label: "actividad", peso: 0.5 }, otro: { label: "pendiente", peso: 0.5 },
};
const shortTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return ` a las ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
};
function eventPhrase(e: MyEvent) {
  const k = KIND[e.kind] ?? KIND.otro;
  if (e.subject) return `**${k.label} de ${e.subject}**${shortTime(e.event_time)}`;
  return `**${e.title}**${shortTime(e.event_time)}`;
}
const pendientes = (evs: MyEvent[]) => evs.filter((e) => !e.done);
const inRange = (ctx: Contexto, r: { from: string; to: string }) => pendientes(ctx.events).filter((e) => e.event_date >= r.from && e.event_date <= r.to);

/** Prioridad: urgencia del evento × qué tan bajo va en la materia. */
function prioridad(e: MyEvent, ctx: Contexto, est: Estado | null) {
  const days = Math.max(0, diffDays(ctx.today, e.event_date));
  const urg = (KIND[e.kind]?.peso ?? 0.5) / (days + 1);
  const g = est?.grade ?? null;
  const debil = g == null ? 1.5 : g < ctx.passMark ? 3 : g < 4 ? 2 : g < 4.5 ? 1.2 : 0.8;
  return urg * debil;
}

/** Consejo para un grupo de eventos (p. ej. lo de mañana). */
function consejo(evs: MyEvent[], ctx: Contexto, t: Tono): string {
  const conMateria = evs
    .map((e) => { const s = subjectOfEvent(e, ctx.subjects); return { e, est: s ? estado(s, ctx) : null }; })
    .filter((x) => ["examen", "proyecto", "tarea"].includes(x.e.kind));
  if (!conMateria.length) return "";
  const ranked = [...conMateria].sort((a, b) => prioridad(b.e, ctx, b.est) - prioridad(a.e, ctx, a.est));
  const top = ranked[0];
  const conNotas = ranked.filter((x) => x.est?.grade != null);
  if (conNotas.length >= 2) {
    const peor = conNotas.reduce((a, b) => (a.est!.grade! <= b.est!.grade! ? a : b));
    const mejor = conNotas.reduce((a, b) => (a.est!.grade! >= b.est!.grade! ? a : b));
    if (peor.est!.s.id !== mejor.est!.s.id) {
      return pick(t,
        ` Te sugiero que le metas más a **${peor.est!.s.name}**: vas con **${f(peor.est!.grade, ctx)}**, y en ${mejor.est!.s.name} vas pritty con **${f(mejor.est!.grade, ctx)}**. ${cap(needText(peor.est!, ctx, t, ctx.passMark, { materia: true }))}.`,
        ` Te sugiero dedicarle más tiempo a **${peor.est!.s.name}**: vas con **${f(peor.est!.grade, ctx)}**, mientras que en ${mejor.est!.s.name} vas bien con **${f(mejor.est!.grade, ctx)}**. ${cap(needText(peor.est!, ctx, t, ctx.passMark, { materia: true }))}.`);
    }
  }
  if (top.est?.grade != null) {
    const nv = nivel(top.est.grade, ctx);
    const como = nv === "critico" ? pick(t, "ta' apretada la cosa", "estás por debajo") : nv === "reforzar" ? pick(t, "hay que reforzar", "conviene reforzar") : pick(t, "vas bien", "vas bien");
    return ` En **${top.est.s.name}** llevas **${f(top.est.grade, ctx)}**, ${como}: ${needText(top.est, ctx, t)}.`;
  }
  return "";
}

function listar(evs: MyEvent[], ctx: Contexto, conFecha: boolean) {
  return evs.map((e) => (conFecha ? `${relLabel(e.event_date, ctx.today)}: ${eventPhrase(e)}` : eventPhrase(e)));
}

// ---------------------------------------------------------------- Respuestas por tema

function rAgendaRango(q: string, r: Range, ctx: Contexto, t: Tono): Respuesta {
  let evs = inRange(ctx, r);
  const soloExamenes = has(q, /\bexamen(es)?\b/, /\bbimestral(es)?\b/) && !has(q, /\btarea/);
  const soloTareas = has(q, /\btareas?\b/, /\bentreg\w*/) && !has(q, /\bexamen/);
  if (soloExamenes) evs = evs.filter((e) => e.kind === "examen");
  if (soloTareas) evs = evs.filter((e) => e.kind === "tarea" || e.kind === "proyecto");
  const s = findSubject(q, ctx.subjects);
  if (s) evs = evs.filter((e) => subjectOfEvent(e, ctx.subjects)?.id === s.id);

  const cuando = r.kind === "dia" ? relLabel(r.from, ctx.today) : r.label;
  const Cuando = cap(cuando) + (r.kind === "dia" && diffDays(ctx.today, r.from) <= 2 ? ` (${dateLong(r.from)})` : "");
  const que = soloExamenes ? "exámenes" : soloTareas ? "tareas" : "nada";
  const link = { href: `/agenda?mes=${r.from.slice(0, 7)}&dia=${r.from}`, label: "Ver en la agenda" };

  if (has(q, /\bcuant[oa]s\b/)) {
    const n = evs.length;
    return { understood: true, links: [link], text: `${hola(t, "")}${Cuando} tienes **${n} ${soloExamenes ? (n === 1 ? "examen" : "exámenes") : soloTareas ? (n === 1 ? "tarea" : "tareas") : n === 1 ? "cosa" : "cosas"}**${n ? `: ${joinY(listar(evs, ctx, r.kind !== "dia"))}.` : "."}${n >= 3 ? pick(t, " Viene con buco, organízate. 💪", " Organízate bien. 💪") : ""}` };
  }
  if (!evs.length) {
    const next = pendientes(ctx.events).find((e) => e.event_date > r.to);
    const libre = r.kind === "dia" ? pick(t, `${Cuando} no tienes ${que}, ta' libre. 😎`, `${Cuando} no tienes ${que} en la agenda. 🎈`) : pick(t, `${Cuando} no tienes ${que}, ta' tranquilo. 😎`, `${Cuando} no tienes ${que} en la agenda. 🎈`);
    const sig = next ? pick(t, ` Lo próximo es ${eventPhrase(next)} ${relLabel(next.event_date, ctx.today)}, no te confíes.`, ` Lo próximo es ${eventPhrase(next)} ${relLabel(next.event_date, ctx.today)}.`) : "";
    return { understood: true, links: [link], text: hola(t, "") + libre + sig };
  }
  const lista = joinY(listar(evs, ctx, r.kind !== "dia"));
  const pesada = evs.filter((e) => e.kind === "examen").length >= 3;
  const intro = r.kind === "dia" ? `${Cuando} tienes ${lista}.` : `${Cuando} tienes **${evs.length} ${evs.length === 1 ? "cosa" : "cosas"}**: ${lista}.`;
  const extra = pesada ? pick(t, " Diablo, viene pesada. 😅", " Viene una semana pesada.") : "";
  return { understood: true, links: [link], text: hola(t, "") + intro + extra + consejo(evs, ctx, t) };
}

function rCuando(q: string, ctx: Contexto, t: Tono): Respuesta {
  const s = findSubject(q, ctx.subjects);
  const kind = has(q, /\bexamen(es)?\b/, /\bbimestral\b/) ? "examen" : has(q, /\bproyecto/) ? "proyecto" : has(q, /\btarea|\bentreg/) ? "tarea" : null;
  let evs = pendientes(ctx.events).filter((e) => e.event_date >= ctx.today);
  if (kind) evs = evs.filter((e) => e.kind === kind || (kind === "tarea" && e.kind === "proyecto"));
  if (s) evs = evs.filter((e) => subjectOfEvent(e, ctx.subjects)?.id === s.id);
  if (!s && !kind) {
    // "feria de ciencias", "exposición"… buscar por título
    const generic = has(q, /\blo proximo\b/, /\bque es lo proximo\b/, /\bproxim[oa] (cosa|evento|entrega)\b/);
    const words = q.split(" ").filter((w) => w.length > 3 && !["cuando", "cuanto", "falta", "faltan", "proximo", "proxima", "tengo", "para", "dias"].includes(w));
    const byTitle = pendientes(ctx.events).filter((e) => e.event_date >= ctx.today && words.some((w) => nk(e.title).includes(w)));
    if (byTitle.length) evs = byTitle;
    else if (!generic) return { understood: false, text: pick(t, "No encontré eso en tu agenda, fren. 🤔 Ya le avisé a quien me enseña pa' que aprenda esa pregunta.", "No encontré eso en tu agenda. 🤔 Guardé la pregunta para aprenderla.") };
  }
  const e = evs[0];
  const que = `${kind ?? "nada"}${s ? ` de ${s.name}` : ""}`;
  if (!e) return { understood: true, text: pick(t, `No tienes ${que} en la agenda por ahora, fren. 😎`, `No tienes ${que} en la agenda por ahora.`) };
  const dias = diffDays(ctx.today, e.event_date);
  const falta = dias <= 1 ? "" : ` (faltan **${dias} días**)`;
  const est = (() => { const sub = subjectOfEvent(e, ctx.subjects); return sub ? estado(sub, ctx) : null; })();
  let extra = "";
  if (est && e.kind === "examen") {
    extra = ` ${cap(needText(est, ctx, t))}.`;
    if (est.target > ctx.passMark) extra += ` ${pick(t, "Pa'", "Para")} tu meta de **${f(est.target, ctx)}**, ${needText(est, ctx, t, est.target, { prefijo: false })}.`;
  }
  return {
    understood: true,
    links: [{ href: `/agenda?mes=${e.event_date.slice(0, 7)}&dia=${e.event_date}`, label: "Ver en la agenda" }],
    text: `${e.subject ? "El " : ""}${eventPhrase(e)} es **${dias <= 2 ? relLabel(e.event_date, ctx.today) + `, ${dateLong(e.event_date)}` : dateLong(e.event_date)}**${falta}.${extra}`,
  };
}

function rPendientes(q: string, ctx: Contexto, t: Tono): Respuesta {
  const atras = pendientes(ctx.events).filter((e) => e.event_date < ctx.today && (e.kind === "tarea" || e.kind === "proyecto"));
  const prox = pendientes(ctx.events).filter((e) => e.event_date >= ctx.today && e.event_date <= plus(ctx.today, 14) && e.kind !== "actividad");
  const parts: string[] = [];
  if (!prox.length && !atras.length) return { understood: true, text: pick(t, "No tienes nada pendiente en las próximas dos semanas. Pritty. ✅", "No tienes pendientes en las próximas dos semanas. ✅") };
  if (prox.length) parts.push(`Tienes **${prox.length} ${prox.length === 1 ? "pendiente" : "pendientes"}**: ${joinY(listar(prox, ctx, true))}.`);
  if (atras.length) parts.push(pick(t, `Ojo, fren: tienes **${atras.length}** sin marcar como hecho de días pasados (${joinY(atras.map((e) => eventPhrase(e)))}). Si ya lo entregaste, márcalo en la agenda.`, `Además tienes **${atras.length}** de días pasados sin marcar como hecho (${joinY(atras.map((e) => eventPhrase(e)))}).`));
  else parts.push(pick(t, "Nada atrasado. ✅", "No tienes nada atrasado. ✅"));
  return { understood: true, links: [{ href: "/agenda", label: "Abrir agenda" }], text: hola(t, "") + parts.join(" ") };
}

function rDiaOcupado(q: string, ctx: Contexto, t: Tono): Respuesta {
  const r = parseRange(q, ctx.today) ?? { from: ctx.today, to: plus(ctx.today, 13), kind: "rango" as const, label: "las próximas dos semanas" };
  const evs = inRange(ctx, r);
  const byDay = new Map<string, MyEvent[]>();
  evs.forEach((e) => byDay.set(e.event_date, [...(byDay.get(e.event_date) ?? []), e]));
  if (has(q, /\bmismo dia\b/, /\bdos examenes\b/, /\b2 examenes\b/)) {
    const choques = [...byDay.entries()].filter(([, l]) => l.filter((e) => e.kind === "examen").length >= 2);
    if (!choques.length) return { understood: true, text: pick(t, `No, ${r.label} no tienes dos exámenes el mismo día. 😌`, `No tienes dos exámenes el mismo día ${r.label}.`) };
    const [dia, l] = choques[0];
    return { understood: true, text: pick(t, `Ojo: ${relLabel(dia, ctx.today)} tienes **${l.filter((e) => e.kind === "examen").length} exámenes** (${joinY(l.filter((e) => e.kind === "examen").map(eventPhrase))}). Empieza a estudiar desde antes.`, `Sí: ${relLabel(dia, ctx.today)} tienes ${joinY(l.filter((e) => e.kind === "examen").map(eventPhrase))}.`) + consejo(l, ctx, t) };
  }
  if (!byDay.size) return { understood: true, text: pick(t, `${cap(r.label)} ta' todo libre. 😎`, `${cap(r.label)} no tienes nada en la agenda.`) };
  const peso = (l: MyEvent[]) => l.reduce((a, e) => a + (KIND[e.kind]?.peso ?? 0.5), 0);
  const dias = [...byDay.entries()].sort((a, b) => peso(b[1]) - peso(a[1]));
  const [dMax, lMax] = dias[0];
  let libre: string | null = null;
  for (let i = 0; i <= diffDays(r.from, r.to); i++) {
    const day = plus(r.from, i);
    const wd = new Date(day + "T12:00:00Z").getUTCDay();
    if (wd !== 0 && wd !== 6 && !byDay.has(day)) { libre = day; break; }
  }
  return {
    understood: true,
    text: `${hola(t, "")}El día más pesado es **${relLabel(dMax, ctx.today)}**: ${joinY(lMax.map(eventPhrase))}.` +
      (libre ? pick(t, ` El más libre es **${relLabel(libre, ctx.today)}**, aprovéchalo pa' adelantar. 😉`, ` El más libre es **${relLabel(libre, ctx.today)}**: buen día para adelantar.`) : ""),
  };
}

function rFecha(q: string, ctx: Contexto, t: Tono): Respuesta | null {
  // ¿Cuántos días faltan para…?
  if (has(q, /\bcuantos dias\b/, /\bcuanto falta\b/, /\bcuantas semanas\b/)) {
    const s = findSubject(q, ctx.subjects);
    if (s || has(q, /\bexamen|\bbimestral|\bproyecto|\btarea|\bferia|\bentrega/)) return rCuando(q, ctx, t);
    const r = parseRange(q, ctx.today);
    if (r) {
      const n = diffDays(ctx.today, r.from);
      return { understood: true, text: n === 0 ? `¡Es hoy! (${dateLong(r.from)})` : `Faltan **${n} ${n === 1 ? "día" : "días"}** pa'l ${dateLong(r.from)}.`.replace("pa'l", pick(t, "pa'l", "para el")) };
    }
    return null;
  }
  // ¿Qué fecha es hoy?
  if (has(q, /\bque (fecha|dia) es hoy\b/, /\ba cuanto estamos\b/, /\bque fecha es\b$/, /\bfecha de hoy\b/, /^que dia es$/)) {
    return { understood: true, text: `Hoy es **${dateLong(ctx.today)}**.` };
  }
  if (has(q, /\ben que semana estamos\b/)) {
    const mon = plus(ctx.today, -((new Date(ctx.today + "T12:00:00Z").getUTCDay() + 6) % 7));
    return { understood: true, text: `Estamos en la semana del **${dateLong(mon)}** al **${dateLong(plus(mon, 6))}**.` };
  }
  const r = parseRange(q, ctx.today);
  if (!r || r.kind !== "dia") return null;
  const evs = inRange(ctx, r);
  const extra = evs.length ? ` Ese día tienes ${joinY(evs.map(eventPhrase))}.` : pick(t, " Ese día no tienes nada, ta' libre. 😎", " Ese día no tienes nada en la agenda.");
  // "¿Qué día cae el 15?" / "¿el 20 es qué día?" → día de la semana
  if (/\b\d{1,2}\b/.test(q) && !WEEKDAYS.some((w) => has(q, w))) return { understood: true, text: `El **${Number(r.from.slice(8))}** cae **${weekdayName(r.from)}** (${dateLong(r.from)}).${extra}` };
  // "¿Qué fecha es el martes?" / "¿mañana qué día es?" → número
  return { understood: true, text: `${cap(relLabel(r.from, ctx.today).replace(/^el /, "El "))} es **${dateLong(r.from)}**.${extra}` };
}

// ---------------------------------------------------------------- Notas

function rMateria(q: string, s: SubjectData, ctx: Contexto, t: Tono): Respuesta {
  const e = estado(s, ctx);
  const link = { href: `/notas/${s.id}`, label: `Abrir ${s.name}` };
  const meta = q.match(/\b(?:sacar|quedar(?: con| en)?|llegar a|subir(?:la)? a|tener|para)\s+(?:un |una )?([1-9](?:\.\d)?|10)\b/);
  const siSaco = q.match(/\bsi saco (?:un |una )?([0-9](?:\.\d)?|10)\b/) ?? q.match(/\bsaco (?:un |una )?([0-9](?:\.\d)?|10)\b/);

  if (e.grade == null && !s.items.length) {
    return { understood: true, links: [{ href: "/notas/importar", label: "Importar desde Seduca" }, link], text: pick(t, `Todavía no tienes notas en **${s.name}**, fren. Ponlas o impórtalas de Seduca y te digo cuánto necesitas.`, `Aún no tienes notas en **${s.name}**. Agrégalas o impórtalas desde Seduca y te digo cuánto necesitas.`) };
  }

  // ¿Y si saco N?
  if (siSaco) {
    const x = Number(siSaco[1]);
    if (x < ctx.scale.min || x > ctx.scale.max) return { understood: true, text: `Esa nota está fuera de la escala (${ctx.scale.min} a ${ctx.scale.max}).` };
    const items = withVirtual(e);
    if (!items.some((i) => i.score == null)) return { understood: true, links: [link], text: `En **${s.name}** no tienes notas pendientes este ${ctx.periodLabel.toLowerCase()}: llevas **${f(e.grade, ctx)}**.` };
    const g = periodGrade(s.method, s.cats, items, x, ctx.scale.decimals);
    const pasa = g != null && g >= ctx.passMark;
    const cambio = e.grade != null ? (g! > e.grade ? ` (subes de ${f(e.grade, ctx)})` : g! < e.grade ? ` (bajas de ${f(e.grade, ctx)})` : " (te quedas igual)") : "";
    return { understood: true, links: [link], text: `Si sacas **${f(x, ctx)}** en ${e.pendingName} de ${s.name}, el ${ctx.periodLabel.toLowerCase()} te queda en **${f(g, ctx)}**${cambio}. ${pasa ? pick(t, "Pasas. ✅", "Apruebas. ✅") : pick(t, "Ayala, no te alcanza pa' pasar. ❌", "No te alcanza para aprobar. ❌")}` };
  }

  // Meta: "¿cuánto necesito para sacar 4.5?"
  if (meta && Number(meta[1]) !== ctx.passMark && Number(meta[1]) >= ctx.scale.min && Number(meta[1]) <= ctx.scale.max && !has(q, /\bsi saco\b/)) {
    const goal = Number(meta[1]);
    return { understood: true, links: [link], text: `${pick(t, "Pa'", "Para")} quedar con **${f(goal, ctx)}** en **${s.name}**, ${needText(e, ctx, t, goal, { prefijo: false })}.${e.grade != null ? ` ${pick(t, "Ahorita", "Ahora")} llevas **${f(e.grade, ctx)}**.` : ""} 🎯` };
  }

  // Año
  if (has(q, /\bano\b/, /\banual\b/, /\bresto del ano\b/)) {
    const y = e.year;
    if (y.status === "sin-datos") return { understood: true, links: [link], text: `En **${s.name}** todavía no hay notas del año.` };
    const msg = y.status === "aprobado" ? pick(t, "Año pasado. ✅", "Año aprobado. ✅") : y.status === "reprobado" ? "Quedó por debajo de la nota para pasar. ❌"
      : y.status === "imposible" ? pick(t, "Ayala, ya no alcanza pa' pasar el año ni con 5. Habla con tu profe.", "Ya no alcanza para pasar el año ni con la nota máxima; habla con tu profe.")
      : `Pa' pasar el año necesitas promediar **${f(y.needed, ctx)}** en ${y.remaining === 1 ? `el ${ctx.periodLabel.toLowerCase()} que falta` : `los ${y.remaining} ${ctx.periodLabel.toLowerCase()}s que faltan`}.`.replace("Pa' ", pick(t, "Pa' ", "Para "));
    return { understood: true, links: [link], text: `En **${s.name}** llevas **${f2(y.average, ctx)}** de promedio del año. ${msg}` };
  }

  // Pendientes / partes
  if (has(q, /\bpendientes?\b/, /\bme falta\b/, /\bya me pusieron\b/, /\bdigitacion\b/, /\bapreciacion\b/, /\bbimestral\b/) && !has(q, /\bpasar\b/, /\bnecesito\b/, /\bsacar\b/)) {
    const items = s.items.filter((i) => i.period === e.period);
    const partes = s.cats.map((c) => {
      const xs = items.filter((i) => i.category_id === c.id);
      const val = xs.filter((i) => i.score != null);
      const g = val.length ? periodGrade("promedio", [], val, undefined, ctx.scale.decimals) : null;
      return `${c.name} ${g == null ? (xs.length ? "pendiente" : "sin notas") : f(g, ctx)}`;
    });
    const pend = items.filter((i) => i.score == null).length;
    return { understood: true, links: [link], text: `En **${s.name}** (${ctx.periodLabel.toLowerCase()} ${e.period}): ${partes.join(" · ")}. ${pend ? `Tienes **${pend}** ${pend === 1 ? "nota pendiente" : "notas pendientes"}.` : e.pendingName === "el bimestral" ? "Te falta el bimestral." : "No tienes notas pendientes."}` };
  }

  // Cómo voy / cuánto necesito para pasar
  const nv = nivel(e.grade, ctx);
  const comoVoy = e.grade == null ? "" : nv === "critico" ? pick(t, "ta' apretada la cosa", "vas por debajo de la nota para pasar") : nv === "reforzar" ? pick(t, "vas bien pero hay que reforzar", "vas aprobando, pero conviene reforzar") : nv === "bien" ? pick(t, "vas pritty", "vas bien") : pick(t, "vas volando 🔥", "vas muy bien");
  const need = needText(e, ctx, t);
  const meta2 = e.target > ctx.passMark ? ` ${pick(t, "Pa'", "Para")} tu meta de **${f(e.target, ctx)}**, ${needText(e, ctx, t, e.target, { prefijo: false })}.` : "";
  return {
    understood: true, links: [link],
    text: `${hola(t, "")}En **${s.name}** llevas **${f(e.grade, ctx)}** este ${ctx.periodLabel.toLowerCase()}${comoVoy ? `, ${comoVoy}` : ""}. ${cap(need)}.${e.needPass.status === "asegurado" ? " 🎉" : ""}${meta2}`,
  };
}

function rGeneral(q: string, ctx: Contexto, t: Tono): Respuesta {
  const ests = ctx.subjects.map((s) => estado(s, ctx)).filter((e) => e.grade != null);
  if (!ests.length) return { understood: true, links: [{ href: "/notas/importar", label: "Importar desde Seduca" }], text: pick(t, "Todavía no tienes notas, fren. Impórtalas de Seduca y te digo cómo vas. 📋", "Aún no tienes notas. Impórtalas desde Seduca y te digo cómo vas. 📋") };
  const sorted = [...ests].sort((a, b) => a.grade! - b.grade!);
  const fd = finalDecimals(ctx.scale);
  const avg = Math.floor((ests.reduce((a, e) => a + e.grade!, 0) / ests.length) * 10 ** fd + 1e-9) / 10 ** fd;
  const enRiesgo = ests.filter((e) => e.needPass.status === "imposible" || (e.needPass.status === "necesita" && e.needPass.value >= 3.5) || e.grade! < ctx.passMark);
  const link = { href: "/notas", label: "Ver mis notas" };

  // Peor / mejor / ordenar
  if (has(q, /\bordena\b/, /\bde mejor a peor\b/, /\branking\b/)) {
    return { understood: true, links: [link], text: `De mejor a peor: ${[...sorted].reverse().map((e) => `${e.s.name} ${f(e.grade, ctx)}`).join(" · ")}.` };
  }
  if (has(q, /\bpeor\b/, /\bmas baja\b/, /\bvoy mal\b/, /\bflojo\b/, /\ben rojo\b/, /\bme cuesta\b/, /\bmas pegado\b/, /\bme baja\b/)) {
    const bajas = sorted.slice(0, 2);
    return { understood: true, links: [link], text: `Tu materia más bajita es **${bajas[0].s.name} (${f(bajas[0].grade, ctx)})**${bajas[1] ? `, luego **${bajas[1].s.name} (${f(bajas[1].grade, ctx)})**` : ""}. ${cap(needText(bajas[0], ctx, t, ctx.passMark, { materia: true }))}.`.replace("más bajita", pick(t, "más bajita", "más baja")) };
  }
  if (has(q, /\bmejor\b/, /\bmas alta\b/)) {
    const top = sorted[sorted.length - 1];
    return { understood: true, links: [link], text: pick(t, `Tu mejor materia es **${top.s.name}** con **${f(top.grade, ctx)}**. Vas volando ahí. 🔥`, `Tu mejor materia es **${top.s.name}** con **${f(top.grade, ctx)}**. 🎉`) };
  }
  const arriba = q.match(/\b(arriba|encima|mas) de ([1-9](?:\.\d)?)\b/), abajo = q.match(/\b(abajo|debajo|menos) de ([1-9](?:\.\d)?)\b/);
  if (arriba || abajo) {
    const lim = Number((arriba ?? abajo)![2]);
    const l = ests.filter((e) => (arriba ? e.grade! >= lim : e.grade! < lim));
    return { understood: true, links: [link], text: l.length ? `${arriba ? "Arriba" : "Abajo"} de ${lim}: ${l.map((e) => `${e.s.name} (${f(e.grade, ctx)})`).join(", ")}.` : `Ninguna materia ${arriba ? "arriba" : "abajo"} de ${lim}.` };
  }

  // ¿Cuánto necesito para pasar en todas? / ¿qué materias ya pasé?
  if (has(q, /\bpasar\b/, /\bpaso\b/, /\baprob\w*/, /\bperder\b/, /\basegurad\w*/, /\bpeligro\b/, /\bcada materia\b/, /\btodas\b/, /\bsalvado\b/, /\braspando\b/)) {
    const aseg = ests.filter((e) => e.needPass.status === "asegurado");
    const nec = ests.filter((e) => e.needPass.status === "necesita").sort((a, b) => (b.needPass as { value: number }).value - (a.needPass as { value: number }).value);
    const imp = ests.filter((e) => e.needPass.status === "imposible");
    const partes: string[] = [];
    if (aseg.length) partes.push(pick(t, `Ya tienes aseguradas **${aseg.length}** ${aseg.length === 1 ? "materia" : "materias"} ✅`, `Ya tienes aseguradas **${aseg.length}** ${aseg.length === 1 ? "materia" : "materias"} ✅`));
    if (nec.length) partes.push(`Te falta: ${nec.map((e) => `**${e.s.name}** ${f((e.needPass as { value: number }).value, ctx)}`).join(" · ")}`);
    if (imp.length) partes.push(pick(t, `Ayala, en ${joinY(imp.map((e) => `**${e.s.name}**`))} no alcanza ni con ${ctx.scale.max}: habla con el profe`, `En ${joinY(imp.map((e) => `**${e.s.name}**`))} no alcanza ni con la nota máxima: habla con el profe`));
    const ojo = nec[0] && (nec[0].needPass as { value: number }).value >= 3.5 ? pick(t, ` Ojo con **${nec[0].s.name}**, es la más apretada.`, ` Atención a **${nec[0].s.name}**, es la más ajustada.`) : "";
    return { understood: true, links: [link], text: `${hola(t, "")}${partes.join(". ")}.${ojo} (Lo que necesitas en ${ests.some((e) => e.pendingName === "el bimestral") ? "el bimestral" : "lo pendiente"} de cada una.)` };
  }

  // Meta general
  const metaG = q.match(/\b(?:sacar|quedar(?: con)?|llegar a|tener)\s+([1-9](?:\.\d)?)\b/);
  if (metaG && has(q, /\bpromedio\b|\bgeneral\b|\bcuadro de honor\b/)) {
    const goal = Number(metaG[1]);
    const bajas = sorted.filter((e) => e.grade! < goal).slice(0, 3);
    return { understood: true, links: [link], text: `Tu promedio es **${f2(avg, ctx)}**. ${avg >= goal ? pick(t, `Ya estás arriba de ${goal}, mantente así. 🔥`, `Ya estás por encima de ${goal}. 🎉`) : `Pa' llegar a **${goal}** te conviene subir ${joinY(bajas.map((e) => `**${e.s.name}** (${f(e.grade, ctx)})`))}: son las que más te bajan.`.replace("Pa' ", pick(t, "Pa' ", "Para "))}` };
  }

  // Resumen general
  const top = sorted[sorted.length - 1], low = sorted[0];
  return {
    understood: true, links: [link],
    text: `${hola(t, "")}Tu promedio general es **${f2(avg, ctx)}**${avg >= 4.5 ? " 🔥" : avg >= 4 ? " 🎉" : ""}. Tu mejor materia es **${top.s.name} (${f(top.grade, ctx)})** y la que más te cuesta es **${low.s.name} (${f(low.grade, ctx)})**.` +
      (enRiesgo.length ? pick(t, ` Ojo con ${joinY(enRiesgo.map((e) => `**${e.s.name}**`))}.`, ` Presta atención a ${joinY(enRiesgo.map((e) => `**${e.s.name}**`))}.`) : pick(t, " Vas pasando todo. ✅", " Vas aprobando todas. ✅")),
  };
}

function rNotasPendientes(ctx: Contexto, t: Tono): Respuesta {
  const l = ctx.subjects.map((s) => {
    const e = estado(s, ctx);
    const n = s.items.filter((i) => i.period === e.period && i.score == null).length;
    return { s, n, falta: n === 0 && e.pendingName === "el bimestral" };
  }).filter((x) => x.n > 0 || x.falta);
  if (!l.length) return { understood: true, text: "No tienes notas pendientes. ✅" };
  return { understood: true, links: [{ href: "/notas", label: "Ver mis notas" }], text: `Te faltan notas en: ${l.map((x) => `**${x.s.name}** (${x.n ? `${x.n} pendiente${x.n > 1 ? "s" : ""}` : "el bimestral"})`).join(", ")}.` };
}

// ---------------------------------------------------------------- Recomendaciones

function rEstudiar(q: string, ctx: Contexto, t: Tono): Respuesta {
  const r = parseRange(q, ctx.today);
  const plan = has(q, /\bplan\b/, /\borganiz\w*/, /\breparto\b/, /\bsemana\b/);
  const horizonte = plan ? { from: ctx.today, to: plus(ctx.today, 6) } : r && r.kind === "dia" && diffDays(ctx.today, r.from) >= 1 ? { from: ctx.today, to: r.from } : { from: ctx.today, to: plus(ctx.today, 7) };
  const evs = inRange(ctx, horizonte).filter((e) => ["examen", "proyecto", "tarea"].includes(e.kind));
  const scored = evs.map((e) => { const s = subjectOfEvent(e, ctx.subjects); const est = s ? estado(s, ctx) : null; return { e, est, p: prioridad(e, ctx, est) }; }).sort((a, b) => b.p - a.p);

  if (plan && scored.length) {
    // Un día por evento, empezando por los más importantes y antes de su fecha
    const used = new Map<string, string[]>();
    for (const x of scored.slice(0, 6)) {
      // El día anterior a la entrega; si ya está ocupado, uno antes (sin pasar de hoy)
      let day = plus(x.e.event_date, -1);
      if (day < ctx.today) day = ctx.today;
      while (used.has(day) && day > ctx.today) day = plus(day, -1);
      const name = `**${x.est?.s.name ?? x.e.title}** (${KIND[x.e.kind]?.label} ${relLabel(x.e.event_date, ctx.today)}${x.est?.grade != null ? `, vas con ${f(x.est.grade, ctx)}` : ""})`;
      used.set(day, [...(used.get(day) ?? []), name]);
    }
    const lineas = [...used.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, l]) => `${cap(relLabel(day, ctx.today))}: ${l.join(" + ")}`);
    return { understood: true, links: [{ href: "/agenda", label: "Abrir agenda" }], text: `${hola(t, "")}Tu plan: ${lineas.join(" · ")}. Le di prioridad a lo que es examen y donde vas más bajito.`.replace("más bajito", pick(t, "más bajito", "más bajo")) };
  }
  if (scored.length) {
    const [a, b] = scored;
    const porQue = a.est?.grade != null ? `: tienes ${KIND[a.e.kind].label} ${relLabel(a.e.event_date, ctx.today)} y vas con **${f(a.est.grade, ctx)}**` : `: tienes ${KIND[a.e.kind].label} ${relLabel(a.e.event_date, ctx.today)}`;
    const luego = b ? ` Después, si te da tiempo, ${b.est?.s.name ?? b.e.title} (${KIND[b.e.kind].label} ${relLabel(b.e.event_date, ctx.today)}).` : "";
    return { understood: true, text: `${hola(t, "")}${pick(t, "Métele a", "Te sugiero estudiar")} **${a.est?.s.name ?? a.e.title}**${porQue}.${luego}` };
  }
  // Sin eventos: la materia más baja
  const ests = ctx.subjects.map((s) => estado(s, ctx)).filter((e) => e.grade != null).sort((x, y) => x.grade! - y.grade!);
  if (ests.length) return { understood: true, text: pick(t, `No tienes exámenes cerca. 😎 Aprovecha pa' reforzar **${ests[0].s.name}**, que es donde vas más bajito (${f(ests[0].grade, ctx)}).`, `No tienes exámenes próximos. Aprovecha para reforzar **${ests[0].s.name}**, tu materia más baja (${f(ests[0].grade, ctx)}).`) };
  return { understood: true, text: pick(t, "No tienes nada cerca ni notas pa' comparar. Agrega tus notas y tu agenda y te armo un plan. 📋", "No tengo eventos ni notas para recomendarte. Agrega tus notas y tu agenda y te armo un plan.") };
}

function rAnimo(q: string, ctx: Contexto, t: Tono): Respuesta {
  const ests = ctx.subjects.map((s) => estado(s, ctx)).filter((e) => e.grade != null);
  const s = findSubject(q, ctx.subjects);
  if (s && has(q, /\bsaque\b/, /\bme fue mal\b/)) {
    const e = estado(s, ctx);
    return { understood: true, text: pick(t, `Tranquilo, fren, una nota no define el bimestre. 💪 En **${s.name}** llevas **${f(e.grade, ctx)}** y ${needText(e, ctx, t)}. ¡Tú puedes!`, `Una nota baja no define el bimestre. 💪 En **${s.name}** llevas **${f(e.grade, ctx)}** y ${needText(e, ctx, t)}. ¡Tú puedes!`) };
  }
  if (!ests.length) return { understood: true, text: pick(t, "¡Ánimo, fren! 💪 Paso a paso. Pon tus notas y te ayudo a ver cuánto necesitas.", "¡Ánimo! 💪 Agrega tus notas y te ayudo a ver cuánto necesitas.") };
  const bien = ests.filter((e) => e.grade! >= 4).length;
  const low = ests.reduce((a, b) => (a.grade! <= b.grade! ? a : b));
  return { understood: true, text: pick(t, `Respira, mopri. 😌 Vas bien en **${bien} de ${ests.length}** materias. Lo único que necesita atención es **${low.s.name}**: ${needText(low, ctx, t)}. ¡Tú puedes! 💪`, `Tranquilo. 😌 Vas bien en **${bien} de ${ests.length}** materias. Lo que necesita atención es **${low.s.name}**: ${needText(low, ctx, t)}. ¡Tú puedes! 💪`) };
}

// ---------------------------------------------------------------- Acciones

function rAccion(q: string, raw: string, ctx: Contexto, t: Tono): Respuesta | null {
  // Marcar como hecho
  if (has(q, /\bya (hice|entregue|termine|presente)\b/, /\bmarca(r)? como hech/, /\bmarcala\b/, /\bya la hice\b/)) {
    const s = findSubject(q, ctx.subjects);
    const cands = pendientes(ctx.events).filter((e) => (!s || subjectOfEvent(e, ctx.subjects)?.id === s.id) && (e.kind === "tarea" || e.kind === "proyecto" || has(q, /\bexamen\b/)))
      .sort((a, b) => Math.abs(diffDays(ctx.today, a.event_date)) - Math.abs(diffDays(ctx.today, b.event_date)));
    const e = cands[0];
    if (!e) return { understood: true, text: `No encontré esa ${s ? `tarea de ${s.name}` : "tarea"} pendiente en tu agenda.` };
    const quedan = pendientes(ctx.events).filter((x) => x.id !== e.id && x.event_date >= ctx.today && x.event_date <= plus(ctx.today, 7)).length;
    return { understood: true, action: { type: "marcarHecho", eventId: e.id }, text: `${pick(t, "¡Pritty! ✅", "¡Listo! ✅")} Marqué como hecha: ${eventPhrase(e)} (${relLabel(e.event_date, ctx.today)}). Te ${quedan === 1 ? "queda **1 pendiente**" : `quedan **${quedan} pendientes**`} esta semana.` };
  }
  // Agregar a la agenda
  if (has(q, /^(agrega|anota|apunta|pon|ponme|recuerdame|agendame|crea|mete)\b/, /\b(agrega|anota|apunta|recuerdame|agendame)\b/)) {
    const r = parseRange(q, ctx.today);
    const s = findSubject(q, ctx.subjects);
    const kind = has(q, /\bexamen|\bbimestral/) ? "examen" : has(q, /\bproyecto/) ? "proyecto" : has(q, /\btarea|\bentrega/) ? "tarea" : has(q, /\bexposicion|\bactividad|\bferia|\bgira/) ? "actividad" : "otro";
    const estudiar = has(q, /\bestudiar\b|\brepasar\b/);
    const titulo = estudiar ? `Estudiar ${s?.name ?? ""}`.trim() : s ? `${cap(KIND[kind]?.label ?? "Pendiente")} de ${s.name}` : cap(raw.replace(/^(agrega|anota|apunta|pon|ponme|recuérdame|recuerdame|agéndame|agendame|crea|mete)\s+/i, "").replace(/[¿?¡!]/g, "").slice(0, 60));
    const date = r?.from ?? ctx.today;
    const params = new URLSearchParams({ nuevo: "1", fecha: date, mes: date.slice(0, 7), dia: date, tipo: estudiar ? "otro" : kind, titulo });
    if (s) params.set("materia", s.name);
    return { understood: true, action: { type: "abrir", href: `/agenda?${params}`, label: "Revisar y guardar" }, text: `${pick(t, "Ofi 👍", "Listo 👍")} Te preparé **${titulo}** para ${relLabel(date, ctx.today)} (${dateLong(date)}). Toca **Revisar y guardar** pa' confirmarlo.`.replace("pa' ", pick(t, "pa' ", "para ")) };
  }
  if (has(q, /\b(abre|abrir|ir a|llevame a|muestrame)\b/)) {
    if (has(q, /\bnotas?\b/)) return { understood: true, action: { type: "abrir", href: "/notas", label: "Abrir mis notas" }, text: "Abriendo tus notas… 📊" };
    if (has(q, /\bagenda\b|\bcalendario\b/)) return { understood: true, action: { type: "abrir", href: "/agenda", label: "Abrir agenda" }, text: "Abriendo tu agenda… 📅" };
    if (has(q, /\bimport\w*\b|\bseduca\b/)) return { understood: true, action: { type: "abrir", href: "/notas/importar", label: "Importar desde Seduca" }, text: "Abriendo la importación desde Seduca… 📋" };
  }
  if (has(q, /\bcelular\b|\btelefono\b|\biphone\b|\bandroid\b|\bgoogle calendar\b/) && has(q, /\bagenda\b|\bcalendario\b|\bpongo\b/)) {
    return { understood: true, links: [{ href: "/agenda#sync", label: "Ir a la agenda" }], text: "En **Agenda**, baja hasta **📱 Recordatorios en tu celular** y toca **Suscribirme**: tus eventos aparecen solos en el calendario del celular y te avisa." };
  }
  return null;
}

// ---------------------------------------------------------------- Función principal

const AYUDA = (t: Tono) => pick(t,
  "Te puedo decir qué tienes cualquier día, cuánto necesitas pa' pasar o pa' tu meta, cómo vas en cada materia y qué te conviene estudiar. Prueba: *“¿Qué tengo mañana?”*, *“¿Cuánto necesito pa' pasar mate?”* o *“¿Qué estudio hoy?”* 😉",
  "Puedo decirte qué tienes cualquier día, cuánto necesitas para pasar o para tu meta, cómo vas en cada materia y qué te conviene estudiar. Prueba con: *“¿Qué tengo mañana?”*, *“¿Cuánto necesito para pasar Física?”* o *“¿Qué estudio hoy?”*");

function responderBase(raw: string, ctx: Contexto): Respuesta {
  const q = normalize(raw);
  const t: Tono = { pana: speaksPana(raw) };
  if (!q) return { understood: true, text: AYUDA(t) };

  // Groserías: respuesta tranquila y no se guarda en la lista
  if (esGroseria(q)) {
    return { understood: true, text: pick(t, "Ey, tranqui, fren 😅. Yo estoy pa' ayudarte con tu agenda y tus notas. Prueba: *“¿Qué tengo mañana?”*", "Tranquilo 😅. Estoy para ayudarte con tu agenda y tus notas. Prueba: *“¿Qué tengo mañana?”*") };
  }

  // Respuestas que enseñó el administrador (si el parecido es claro, van primero)
  const faq = matchFaq(q, ctx.faq ?? []);
  if (faq?.strong) return { understood: true, text: faq.faq.answer };

  // Saludos, gracias, ayuda
  if (has(q, /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey)( \w+)?$/)) return { understood: true, text: pick(t, `¡Xopá${ctx.firstName ? `, ${ctx.firstName}` : ""}! 👋 ¿Qué quieres saber? ${AYUDA(t)}`, `¡Hola${ctx.firstName ? `, ${ctx.firstName}` : ""}! 👋 ${AYUDA(t)}`) };
  if (has(q, /^(gracias|muchas gracias|grax|thanks|ok|vale|listo|chevere|pritty)( \w+)?$/)) return { understood: true, text: pick(t, "¡A la orden, fren! 🙌", "¡Con gusto! 🙌") };
  if (has(q, /\bcomo funciona (la app|la aplicacion|la pagina|esto|esta app|esta pagina|aula)\b/, /\bexplica\w* (la app|la aplicacion|la pagina|como funciona)\b/, /\btutorial\b/, /\bguia\b/, /\brecorrido\b/, /\bque (es|hace) (esta|la) (app|aplicacion|pagina)\b/, /\bcomo se usa\b/, /\bcomo uso (la app|esto|la pagina)\b/, /\bexplica\w* que es (esta|esto|la)\b/, /^que es (esto|esta cosa|esta app|esta pagina|aula)\b/, /\bpara que sirve (esto|esta app|esta pagina|la app)\b/)) {
    return { understood: true, action: { type: "tour" }, text: pick(t, "¡De una! Te explico cómo funciona la app. 👇", "¡Claro! Te explico cómo funciona la app. 👇") };
  }
  if (has(q, /\bque (puedes|sabes) hacer\b/, /\bayuda\b/, /\bque te (puedo|pregunto)\b/, /\bcomo funcionas\b/)) return { understood: true, text: AYUDA(t) };

  // Acciones
  const acc = rAccion(q, raw, ctx, t);
  if (acc) return acc;

  // Ánimo
  if (has(q, /\bestresad\w*/, /\bme fue mal\b/, /\bdame animo\b/, /\bsaque (un |una )?[0-2](\.\d)?\b/, /\bno puedo mas\b/, /\btriste\b/, /\bpreocupad\w*/)) return rAnimo(q, ctx, t);

  // Recomendaciones
  if (has(q, /\bque (estudio|repaso|debo estudiar|deberia estudiar|hago primero|priorizo)\b/, /\ba que le meto\b/, /\ble meto\b/, /\bque estudio\b/, /\bplan\b/, /\borganiz\w*/, /\breforzar\b/, /\bmas urgente\b/, /\bpriorizo\b/, /\ben que me enfoco\b/, /\bsubir mi promedio\b/, /\bvale la pena\b/, /\breparto\b/)) {
    if (has(q, /\bsubir mi promedio\b/)) return rGeneral(q.replace("subir mi promedio", "peor"), ctx, t);
    return rEstudiar(q, ctx, t);
  }

  // Fechas (día ↔ número, cuántos días faltan)
  const esFecha = has(q, /\bque (fecha|dia)\b/, /\ba cuanto estamos\b/, /\bcuantos dias\b/, /\bcuantas semanas\b/, /\bcae\b/, /\bque dia de la semana\b/, /\ben que semana\b/, /\bfecha de hoy\b/, /\bes que dia\b/, /\bes que fecha\b/) ||
    (has(q, /\bcuanto falta\b/) && !has(q, /\bpasar\b|\bnota\b|\bsacar\b|\bmeta\b/));
  if (esFecha && !has(q, /\bque dia (tengo|esta) mas\b/, /\bmas libre\b/)) {
    const r = rFecha(q, ctx, t);
    if (r) return r;
  }

  // Agenda: día más pesado / más libre / dos exámenes el mismo día
  if (has(q, /\bmas (cosas|pesado|cargado|libre|tranquilo)\b/, /\bmismo dia\b/, /\bme conviene estudiar\b/)) return rDiaOcupado(q, ctx, t);

  // Agenda: ¿cuándo es…?
  if (has(q, /\bcuando (es|son|hay|tengo|entrego|toca|cae)\b/, /\bproxim[oa] (examen|tarea|entrega|proyecto)\b/, /\blo proximo\b/, /\bque es lo proximo\b/, /\ba que hora\b/, /\bcual es (mi|el) proxim/)) return rCuando(q, ctx, t);

  // Agenda: pendientes
  if (has(q, /\bme falta entregar\b/, /\batrasad\w*/, /\bque no he hecho\b/, /\b(tareas|cosas|proyectos) pendientes\b/, /\bque tengo pendiente\b/, /\bque me falta\b/) && !findSubject(q, ctx.subjects) && !has(q, /\bnotas?\b/)) return rPendientes(q, ctx, t);

  // Notas
  const s = findSubject(q, ctx.subjects);
  const sobreNotas = has(q, /\bnotas?\b/, /\bpromedio\b/, /\bpasar\b/, /\bpaso\b/, /\baprob\w*/, /\bperder\b/, /\bnecesito\b/, /\bsacar\b/, /\bsaco\b/, /\bcomo voy\b/, /\bcomo estoy\b/, /\bvoy bien\b/, /\bcuanto (tengo|llevo|me falta)\b/, /\bmeta\b/, /\bsalvado\b/, /\braspando\b/, /\bbulto\b/, /\bdigitacion\b/, /\bapreciacion\b/, /\bmateria\b/, /\bmaterias\b/, /\bcuadro de honor\b/, /\bano\b/, /\ben rojo\b/, /\bpeor\b/, /\bmejor\b/, /\bpendientes\b/, /\bme baja\b/);
  const sobreAgenda = has(q, /\bque (tengo|hay|me toca|entrego|debo llevar|vainas|cosas)\b/, /\btengo (algo|examen|examenes|tarea|tareas|proyecto|que)\b/, /\bhay (examen|algo|tarea)\b/, /\bdime (lo|todo)\b/, /\bresum\w* la semana\b/, /\bcomo viene\b/, /\besta pesada\b/, /\bpuedo descansar\b/, /\bpublicaron\b/, /\bagenda\b/, /\bentrego\b/, /\bpara estudiar\b/);
  const rango = parseRange(q, ctx.today);

  if (s && (sobreNotas || !sobreAgenda) && !(rango && sobreAgenda)) {
    if (has(q, /\bnotas pendientes\b/) && !s) return rNotasPendientes(ctx, t);
    return rMateria(q, s, ctx, t);
  }
  if (has(q, /\bnotas pendientes\b/, /\bque notas me faltan\b/, /\bcuantas notas\b/)) return rNotasPendientes(ctx, t);
  if (sobreNotas && !sobreAgenda) return rGeneral(q, ctx, t);

  // Agenda por rango de fechas
  if (rango || sobreAgenda) {
    const r = rango ?? { from: ctx.today, to: plus(ctx.today, 6), kind: "rango" as const, label: "los próximos días" };
    return rAgendaRango(q, r, ctx, t);
  }

  // Solo el nombre de una materia: "¿y Química?"
  if (s) return rMateria(q, s, ctx, t);

  return {
    understood: false,
    text: pick(t,
      "Uy, esa no la pillé, fren. 😅 Prueba con: *“¿Qué tengo mañana?”*, *“¿Cuánto necesito pa' pasar mate?”*, *“¿Qué día cae el 15?”* o *“¿Qué estudio hoy?”*. Ya le avisé a quien me enseña pa' que aprenda esa pregunta.",
      "No entendí esa pregunta. 😅 Prueba con: *“¿Qué tengo mañana?”*, *“¿Cuánto necesito para pasar Física?”*, *“¿Qué día cae el 15?”* o *“¿Qué estudio hoy?”*. Guardé la pregunta para enseñármela después."),
  };
}

/** Responde; si no entendió, revisa antes las respuestas que enseñó el administrador. */
export function responder(raw: string, ctx: Contexto): Respuesta {
  const r = responderBase(raw, ctx);
  if (r.understood) return r;
  const m = matchFaq(normalize(raw), ctx.faq ?? []);
  return m ? { understood: true, text: m.faq.answer } : r;
}
