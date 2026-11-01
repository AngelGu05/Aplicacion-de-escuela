import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Cliente con la Secret key. Salta las reglas de seguridad de la base de datos,
 * así que SOLO se usa en el servidor, después de comprobar quién hace la petición.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
