import { createClient } from "@supabase/supabase-js";

export const supabaseProjectRef = "stkgsygonyxtrdhlgusx";
const expectedSupabaseUrl = `https://${supabaseProjectRef}.supabase.co`;

export const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || expectedSupabaseUrl
).replace(/\/$/, "");

export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

const authStorageKey = `sb-${supabaseProjectRef}-auth-token`;

// Alias temporal para componentes antiguos mientras termina la migracion.
export const supabaseAnonKey = supabasePublishableKey;

if (supabaseUrl !== expectedSupabaseUrl) {
  throw new Error(
    `VITE_SUPABASE_URL debe apuntar al proyecto ${supabaseProjectRef}. ` +
      `Valor recibido: ${supabaseUrl}`,
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    "Falta VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.",
  );
}

// La sesión administrativa vive solo durante la pestaña/ventana actual.
// Se elimina la clave anterior para no reutilizar sesiones persistidas en localStorage.
window.localStorage.removeItem(authStorageKey);

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: authStorageKey,
      storage: window.sessionStorage,
    },
  },
);

export const registrarAccesoUrl =
  `${supabaseUrl}/functions/v1/registrar-acceso`;
