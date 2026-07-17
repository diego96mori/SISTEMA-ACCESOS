import { supabase, supabaseUrl } from "../supabaseClient";

const configuredNetboxBackendUrl = import.meta.env.VITE_NETBOX_BACKEND_URL?.trim();
const netboxConsultaUrl = configuredNetboxBackendUrl ||
  `${supabaseUrl}/functions/v1/netbox-consulta`;
const netboxBackendBase = configuredNetboxBackendUrl
  ? configuredNetboxBackendUrl.replace(/\/consulta\/?$/, "")
  : null;

async function parseResponse(response) {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "No se pudo completar la operacion con NetBox");
  }
  return result;
}

async function requestNetbox(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(
      "No se pudo conectar al servicio de NetBox. Verifique la red o VPN y vuelva a intentarlo.",
    );
  }
}

async function adminRequest(path, body) {
  if (!netboxBackendBase) {
    throw new Error(
      "Falta configurar VITE_NETBOX_BACKEND_URL para administrar NetBox",
    );
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("La sesion del administrador expiro");
  }

  const response = await requestNetbox(`${netboxBackendBase}/admin/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function obtenerContextoEquipos(codigo) {
  const { data, error } = await supabase.rpc("obtener_contexto_equipos", {
    p_codigo: codigo,
  });

  if (error) throw new Error(error.message);
  const contexto = Array.isArray(data) ? data[0] : data;
  if (!contexto) throw new Error("La solicitud no está autorizada para equipos");
  return contexto;
}

export async function obtenerResumenMovimientoEquipos(codigo) {
  const { data, error } = await supabase.rpc(
    "obtener_resumen_movimiento_equipos",
    { p_codigo: codigo },
  );
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function consultarCatalogoNetbox(codigo, recurso, filtros = {}) {
  const response = await requestNetbox(netboxConsultaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo, recurso, ...filtros }),
  });
  const result = await parseResponse(response);
  return result.results ?? [];
}

export async function consultarCatalogoNetboxAdmin(
  movimientoId,
  recurso,
  filtros = {},
) {
  const result = await adminRequest("catalogo", {
    movimiento_id: movimientoId,
    recurso,
    ...filtros,
  });
  return result.results ?? [];
}

export async function procesarMovimientoNetbox(movimientoId, aprobaciones) {
  return adminRequest("procesar", {
    movimiento_id: movimientoId,
    aprobaciones,
  });
}

export async function consultarRacksAdmin(nodoId) {
  const result = await adminRequest("racks-view", {
    nodo_id: nodoId,
    recurso: "racks",
  });
  return result.results ?? [];
}

export async function sincronizarNodosNetbox() {
  return adminRequest("sync-sites", {});
}

export async function consultarElevacionRackAdmin(nodoId, rackId) {
  const result = await adminRequest("racks-view", {
    nodo_id: nodoId,
    recurso: "elevacion",
    rack_id: rackId,
  });
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
