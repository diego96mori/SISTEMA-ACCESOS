import { createClient } from "@supabase/supabase-js";

export const supabaseProjectRef = "stkgsygonyxtrdhlgusx";
const expectedSupabaseUrl = `https://${supabaseProjectRef}.supabase.co`;

export const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || expectedSupabaseUrl
).replace(/\/$/, "");

export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

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

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const registrarAccesoUrl =
  `${supabaseUrl}/functions/v1/registrar-acceso`;
