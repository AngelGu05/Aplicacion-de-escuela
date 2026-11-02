/**
 * Limpieza del texto y lenguaje panameño.
 * Convierte la pregunta a minúsculas, sin tildes ni signos, y traduce la jerga
 * ("pa'l" → "para el", "finde" → "fin de semana"…) para que el resto la entienda.
 */

/** Palabras que delatan que el alumno habla en panameño (para responderle igual). */
const PANA = [
  "xopa", "sopa", "fren", "mopri", "pelao", "pelaita", "vaina", "vainas", "buco", "ofi", "pritty", "ayala",
  "diablo", "chuleta", "bulto", "queme", "quemo", "quemar", "quemarme", "salvao", "pegao", "raspando", "finde",
  "chantin", "loco", "manito", "bro",
];

const SLANG: [RegExp, string][] = [
  [/\bpa['’]?l\b/g, "para el"],
  [/\bpa['’]/g, "para "],
  [/\bpa\b/g, "para"],
  [/\bta['’]/g, "esta "],
  [/\bq\b/g, "que"],
  [/\b(xq|pq|porq)\b/g, "porque"],
  [/\bsalvao\b/g, "salvado"],
  [/\bpegao\b/g, "pegado"],
  [/\bfinde\b/g, "fin de semana"],
  [/\bla otra semana\b/g, "la proxima semana"],
  [/\bsemana que viene\b/g, "proxima semana"],
  [/\bxopa\b|\bque sopa\b|\bsopa\b/g, "hola"],
  [/\bbuco de\b/g, "muchas"],
  [/\bbuco\b/g, "mucho"],
  [/\bvainas\b/g, "cosas"],
  [/\bvaina\b/g, "cosa"],
  [/\bofi\b/g, "ok"],
  [/\bprueba\b/g, "examen"],
  [/\bpruebas\b/g, "examenes"],
  [/\bparcial(es)?\b/g, "examen"],
  [/\bquiz\b/g, "examen"],
  [/\bfracas\w*\b/g, "perder"],
  [/\bquem\w*\b/g, "perder"],
  [/\bme voy a quedar\b|\bquedarme\b|\bme quedo(?! (con|en \d))\b/g, "perder"],
];

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Pregunta lista para analizar. */
export function normalize(raw: string) {
  let s = stripAccents(raw.toLowerCase()).replace(/[“”"]/g, " ");
  for (const [re, to] of SLANG) s = s.replace(re, to);
  return s
    .replace(/(\d),(\d)/g, "$1.$2") // 4,5 → 4.5
    .replace(/[¿?¡!;:()[\]{}…*_~`'’]/g, " ")
    .replace(/[.,](?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Habló en panameño? Entonces se le responde en panameño. */
export function speaksPana(raw: string) {
  const s = stripAccents(raw.toLowerCase());
  if (/\b(pa['’]l?|ta['’])/.test(s)) return true;
  return PANA.some((w) => new RegExp(`\\b${w}\\b`).test(s));
}

export const has = (s: string, ...patterns: (string | RegExp)[]) =>
  patterns.some((p) => (typeof p === "string" ? new RegExp(`\\b${p}\\b`).test(s) : p.test(s)));

/** Apodos de materias → nombre normalizado. */
export const SUBJECT_ALIASES: Record<string, string[]> = {
  matematicas: ["matematicas", "matematica", "mate", "mates", "math"],
  ingles: ["ingles", "english"],
  biologia: ["biologia", "bio"],
  contabilidad: ["contabilidad", "conta"],
  "educacion fisica": ["educacion fisica", "edu fisica", "ed fisica", "ed. fisica", "edufisica", "deporte", "gimnasia"],
  espanol: ["espanol", "castellano", "lengua"],
  fisica: ["fisica"],
  historia: ["historia"],
  informatica: ["informatica", "info", "compu", "computacion"],
  quimica: ["quimica"],
  religion: ["religion"],
  geografia: ["geografia", "geo"],
  civica: ["civica"],
};
