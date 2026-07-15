import { supabase, supabaseUrl } from "../supabaseClient";

const netboxConsultaUrl =
  import.meta.env.VITE_NETBOX_BACKEND_URL ||
  `${supabaseUrl}/functions/v1/netbox-consulta`;

export async function obtenerContextoEquipos(codigo) {
  const { data, error } = await supabase.rpc("obtener_contexto_equipos", {
    p_codigo: codigo,
  });

  if (error) throw new Error(error.message);
  const contexto = Array.isArray(data) ? data[0] : data;
  if (!contexto) throw new Error("La solicitud no está autorizada para equipos");
  return contexto;
}

export async function consultarCatalogoNetbox(codigo, recurso, filtros = {}) {
  const response = await fetch(netboxConsultaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo, recurso, ...filtros }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "No se pudo consultar NetBox");
  }
  return result.results ?? [];
}

export async function registrarMovimientoEquipos(codigo, detalles) {
  const { data, error } = await supabase.rpc("registrar_movimiento_equipos", {
    p_codigo: codigo,
    p_detalles: detalles,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

export async function denegarMovimientoEquipos(movimientoId, observacion) {
  const { data, error } = await supabase.rpc("denegar_movimiento_equipos", {
    p_movimiento_id: movimientoId,
    p_observacion: observacion,
  });
  if (error) throw new Error(error.message);
  return data;
}
