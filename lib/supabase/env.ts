/** Las claves y la URL nunca llevan espacios: se quitan por si se pegaron con un salto de línea o un espacio. */
function required(name: string, raw: string | undefined): string {
  const value = raw?.replace(/\s+/g, "");
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa el README (sección "Variables de entorno").`,
    );
  }
  return value;
}

export function supabaseUrl() {
  return required("SUPABASE_URL", process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey() {
  return required(
    "SUPABASE_PUBLISHABLE_KEY",
    process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseSecretKey() {
  return required(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
