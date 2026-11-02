/** Cabecera interna con la ruta que pidió el visitante (la pone proxy.ts). */
export const PATH_HEADER = "x-aula-path";

/**
 * Devuelve la ruta interna a la que se puede volver tras el login, o null si no es segura.
 * Solo se aceptan rutas propias (empiezan con "/"), nunca otros sitios.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login") || value.startsWith("/api") || value.startsWith("/setup")) return null;
  if (value === "/") return null;
  return value.slice(0, 500);
}
