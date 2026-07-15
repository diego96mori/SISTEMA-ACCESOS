import { supabase } from "../supabaseClient";

export async function obtenerAdministradorActivo(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("administradores")
    .select("user_id, nombre, activo")
    .eq("user_id", userId)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo validar al administrador: ${error.message}`);
  }

  return data;
}
