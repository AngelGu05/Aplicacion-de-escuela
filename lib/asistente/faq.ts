/**
 * Respuestas que el administrador le enseña al asistente desde el panel.
 * Se reconocen por palabras clave o por parecido con la pregunta de ejemplo.
 */
import { normalize } from "./texto";

export type Faq = { id: string; question: string; keywords: string[]; answer: string };

const STOP = new Set(["que", "el", "la", "los", "las", "de", "del", "en", "es", "un", "una", "y", "o", "a", "al", "me", "mi", "mis", "tu", "se", "por", "para", "con", "cual", "cuales", "cuando", "como", "donde", "hay", "son", "lo", "le", "les", "esta", "este", "esto", "ser", "si", "no", "ya", "hola", "fren", "ey", "io"]);
const words = (s: string) => normalize(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

export function parseKeywords(raw: string) {
  return raw.split(/[,;\n]/).map((k) => normalize(k)).filter((k) => k.length > 1).slice(0, 20);
}

/** Palabras sugeridas como clave a partir de una pregunta. */
export function suggestKeywords(question: string) {
  return [...new Set(words(question))].slice(0, 5).join(", ");
}

export type FaqMatch = { faq: Faq; strong: boolean } | null;

export function matchFaq(q: string, faqs: Faq[]): FaqMatch {
  const qWords = new Set(words(q));
  let best: { faq: Faq; score: number; strong: boolean } | null = null;
  for (const f of faqs) {
    const hits = f.keywords.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q));
    const multi = hits.some((k) => k.includes(" "));
    const fw = words(f.question);
    const overlap = fw.length ? fw.filter((w) => qWords.has(w)).length / fw.length : 0;
    const score = hits.length * 2 + overlap * 3;
    const strong = multi || hits.length >= 2 || overlap >= 0.75;
    const weak = hits.length >= 1 || overlap >= 0.5;
    if ((strong || weak) && (!best || score > best.score)) best = { faq: f, score, strong };
  }
  return best ? { faq: best.faq, strong: best.strong } : null;
}

/** Groserías: se responde con calma y NO se guardan en la lista de no entendidas. */
const GROSERIAS = /\b(chupal\w*|verga|vrg|mierda|hpta|hp|ctm|cdtm|puta|puto|culo|pendej\w*|marica|maric\w*|joder|coño|cono|sapo|idiota|estupid\w*|tonto|gil|awb|ahuevado|ahuevao|chuch\w*|mmg|malparid\w*)\b/;
export const esGroseria = (q: string) => GROSERIAS.test(q);
