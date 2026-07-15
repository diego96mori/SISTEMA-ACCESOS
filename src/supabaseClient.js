import { createClient } from "@supabase/supabase-js";

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://htyxagckhetrdvlvzvnn.supabase.co";

export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

// Alias temporal para componentes antiguos mientras termina la migracion.
export const supabaseAnonKey = supabasePublishableKey;

if (!supabasePublishableKey) {
  console.warn(
    "Falta VITE_SUPABASE_PUBLISHABLE_KEY en .env.local. " +
      "Las consultas a Supabase no funcionaran hasta configurarla.",
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey || "publishable-key-not-configured",
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
