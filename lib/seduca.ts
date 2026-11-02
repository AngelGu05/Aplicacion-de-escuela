/**
 * Lee la tabla de calificaciones copiada de Seduca (Ctrl+C / Ctrl+V).
 *
 * Cada fila llega con columnas separadas por tabulador:
 *   Materia | Digitación | Prom. | Apreciación | Prom. | Bimestral | Prom. | Prom. Final
 * Dentro de cada parte las notas vienen pegadas: "4.84.14.1" = 4.8, 4.1, 4.1.
 * "-" = nota que todavía no ponen (se importa como pendiente). "X" = no cuenta.
 */

export type SeducaRow = {
  name: string;
  digitacion: (number | null)[]; // null = pendiente
  apreciacion: (number | null)[];
  bimestral: (number | null)[];
  seducaFinal: number | null; // el promedio final que muestra Seduca (para comprobar)
};

const TOKEN = /X|x|-|–|\d{1,3}(?:[.,]\d)?/g;

/** "4.84.14.1" → [4.8, 4.1, 4.1];  "4.6X4.3" → [4.6, 4.3];  "--" → [null, null] */
export function splitGrades(cell: string): (number | null)[] {
  const out: (number | null)[] = [];
  const s = cell.replace(/\s+/g, "");
  // Las notas con decimal se separan solas; se lee de izquierda a derecha.
  const re = /(\d{1,2}[.,]\d)|(X|x)|(-|–)|(\d{1,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out.push(Number(m[1].replace(",", ".")));
    else if (m[3]) out.push(null);
    else if (m[4]) out.push(Number(m[4]));
    // m[2] = X → no cuenta
  }
  return out;
}

const firstNumber = (cell: string | undefined) => {
  const g = splitGrades(cell ?? "").find((x) => x != null);
  return g ?? null;
};

export function normalizeName(name: string) {
  return name.replace(/^[*\s]+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type ParseResult = { rows: SeducaRow[]; skipped: string[]; problem?: string };

export function parseSeduca(text: string): ParseResult {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/ /g, " ")).filter((l) => l.trim());
  if (!lines.length) return { rows: [], skipped: [], problem: "Pega la tabla de calificaciones." };
  if (!lines.some((l) => l.includes("\t"))) {
    return { rows: [], skipped: [], problem: "No encuentro las columnas. Copia la tabla desde Seduca en una computadora (selecciónala con el mouse, Ctrl+C y aquí Ctrl+V)." };
  }

  const rows: SeducaRow[] = [];
  const skipped: string[] = [];
  for (const line of lines) {
    const cols = line.split("\t");
    const name = cols[0].replace(/^[*\s]+/, "").trim();
    if (!name || /^(materias?|calificaciones|digitaci[oó]n|prom\.?)$/i.test(name)) continue;
    const dig = splitGrades(cols[1] ?? "");
    const apr = splitGrades(cols[3] ?? "");
    const bim = splitGrades(cols[5] ?? "");
    if (!dig.length && !apr.length && !bim.length) {
      skipped.push(name);
      continue;
    }
    rows.push({ name, digitacion: dig, apreciacion: apr, bimestral: bim, seducaFinal: firstNumber(cols[7]) });
  }
  if (!rows.length) return { rows, skipped, problem: "No encontré notas en lo que pegaste." };
  return { rows, skipped };
}
