import { createServer } from "node:http";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const port = Number(process.env.PORT || 8787);
const netboxUrl = String(process.env.NETBOX_URL || "").replace(/\/$/, "");
const netboxReadToken = String(process.env.NETBOX_TOKEN || "");
const netboxReadTokenKey = String(process.env.NETBOX_TOKEN_KEY || "");
const netboxWriteToken = String(process.env.NETBOX_WRITE_TOKEN || "");
const netboxWriteTokenKey = String(process.env.NETBOX_WRITE_TOKEN_KEY || "");
const netboxAuthScheme = String(process.env.NETBOX_AUTH_SCHEME || "Bearer");
const activeStatus = String(process.env.NETBOX_ACTIVE_STATUS || "active");
const retiredStatus = String(process.env.NETBOX_RETIRED_STATUS || "offline");
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const isPlaceholder = (value) => /REEMPLAZAR|PEGA_AQUI/i.test(value);

function netboxCredential(token, key) {
  if (netboxAuthScheme.toLowerCase() !== "bearer" || token.startsWith("nbt_")) {
    return token;
  }
  if (!key || isPlaceholder(key)) {
    throw new HttpError(503, "Falta NETBOX_TOKEN_KEY para completar el token v2");
  }
  const normalizedKey = key.replace(/^nbt_/i, "");
  return `nbt_${normalizedKey}.${token}`;
}

if (
  !netboxUrl ||
  !netboxReadToken ||
  !supabaseUrl ||
  !supabaseKey ||
  isPlaceholder(netboxReadToken) ||
  isPlaceholder(supabaseKey)
) {
  console.error(
    "Falta completar .env.netbox.local con NETBOX_TOKEN y SUPABASE_PUBLISHABLE_KEY reales",
  );
  process.exit(1);
}

try {
  netboxCredential(netboxReadToken, netboxReadTokenKey);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":
      origin && allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function send(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 128 * 1024) throw new HttpError(413, "Solicitud demasiado grande");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud no contiene JSON valido");
  }
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} no es valido`);
  }
  return parsed;
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Falta la sesion del administrador");
  return match[1];
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseRequest(path, { accessToken, method = "GET", body } = {}) {
  const headers = {
    apikey: supabaseKey,
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error ||
      "Supabase rechazo la operacion";
    throw new HttpError(response.status, message);
  }
  return data;
}

async function netboxRequest(endpoint, { method = "GET", body, write = false } = {}) {
  const token = write ? netboxWriteToken : netboxReadToken;
  const key = write ? netboxWriteTokenKey : netboxReadTokenKey;
  if (!token || isPlaceholder(token)) {
    throw new HttpError(503, "El token de escritura de NetBox no esta configurado");
  }

  const headers = {
    Authorization: `${netboxAuthScheme} ${netboxCredential(token, key)}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${netboxUrl}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    console.error("NetBox response", { status: response.status, method, endpoint });
    const message = typeof data === "object"
      ? JSON.stringify(data).slice(0, 800)
      : String(data || "").slice(0, 800);
    throw new HttpError(502, `NetBox rechazo la operacion: ${message}`);
  }
  return data;
}

async function requireAdmin(request) {
  const accessToken = bearerToken(request);
  const user = await supabaseRequest("/auth/v1/user", { accessToken });
  const isAdmin = await supabaseRequest("/rest/v1/rpc/es_admin", {
    accessToken,
    method: "POST",
    body: {},
  });
  if (!user?.id || isAdmin !== true) throw new HttpError(403, "No autorizado");
  return { accessToken, user };
}

async function getPublicContext(codigo) {
  const rows = await supabaseRequest("/rest/v1/rpc/obtener_contexto_equipos", {
    method: "POST",
    body: { p_codigo: codigo },
  });
  const context = Array.isArray(rows) ? rows[0] : rows;
  if (!context) throw new HttpError(403, "La solicitud no esta autorizada para equipos");
  return context;
}

async function getAdminMovement(movementId, accessToken) {
  const select = [
    "*",
    "accesos(id,codigo_seguimiento,nodo_id,nodos(nombre,netbox_site_id))",
    "movimiento_detalle(*)",
  ].join(",");
  const path = `/rest/v1/movimientos?id=eq.${movementId}&select=${encodeURIComponent(select)}`;
  const rows = await supabaseRequest(path, { accessToken });
  const movement = Array.isArray(rows) ? rows[0] : null;
  if (!movement) throw new HttpError(404, "El movimiento no existe");
  return movement;
}

function normalizeResults(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

function publicEndpoint(resource, body, siteId) {
  switch (resource) {
    case "equipos":
      return `/dcim/devices/?site_id=${siteId}&limit=500`;
    case "fabricantes":
      return "/dcim/manufacturers/?limit=500";
    case "modelos": {
      const manufacturerId = positiveInteger(body.fabricante_id, "fabricante_id");
      return `/dcim/device-types/?manufacturer_id=${manufacturerId}&limit=500`;
    }
    case "nombre": {
      const name = String(body.nombre || "").trim();
      if (!name || name.length > 100) throw new HttpError(400, "El nombre no es valido");
      return `/dcim/devices/?name=${encodeURIComponent(name)}&limit=1`;
    }
    default:
      throw new HttpError(400, "Recurso de NetBox no permitido");
  }
}

function entityId(value) {
  if (value && typeof value === "object") return Number(value.id);
  return Number(value);
}

function entityValue(value) {
  if (value && typeof value === "object") return value.value ?? value.slug ?? value.id;
  return value;
}

async function ensureRackAtSite(rackId, siteId) {
  const rack = await netboxRequest(`/dcim/racks/${rackId}/`);
  if (entityId(rack.site) !== Number(siteId)) {
    throw new HttpError(400, "El rack no pertenece al nodo de la solicitud");
  }
  return rack;
}

async function availablePositions({ rackId, deviceTypeId, siteId, ignoredDeviceId }) {
  await ensureRackAtSite(rackId, siteId);
  const [deviceType, elevationData] = await Promise.all([
    netboxRequest(`/dcim/device-types/${deviceTypeId}/`),
    netboxRequest(`/dcim/racks/${rackId}/elevation/?face=front`),
  ]);
  const height = Math.max(1, Number(deviceType.u_height) || 1);
  const units = normalizeResults(elevationData);
  const byPosition = new Map(
    units.map((unit) => [Number(unit.id ?? unit.position ?? unit.name?.replace(/\D/g, "")), unit]),
  );
  const positions = [];

  for (const start of [...byPosition.keys()].filter(Number.isFinite).sort((a, b) => a - b)) {
    let free = true;
    for (let position = start; position < start + height; position += 1) {
      const unit = byPosition.get(position);
      const deviceId = entityId(unit?.device);
      if (!unit || (unit.occupied && deviceId !== Number(ignoredDeviceId))) {
        free = false;
        break;
      }
    }
    if (free) positions.push({ position: start, height, label: `U${start} - U${start + height - 1}` });
  }
  return positions;
}

async function handlePublicCatalog(body) {
  const codigo = String(body.codigo || "").trim();
  const resource = String(body.recurso || "").trim().toLowerCase();
  if (!codigo) throw new HttpError(400, "Falta el codigo de seguimiento");
  const context = await getPublicContext(codigo);
  const siteId = positiveInteger(context.netbox_site_id, "netbox_site_id");
  const endpoint = publicEndpoint(resource, body, siteId);
  const data = await netboxRequest(endpoint);
  return { ok: true, results: normalizeResults(data) };
}

async function handleAdminCatalog(request, body) {
  const { accessToken } = await requireAdmin(request);
  const movementId = positiveInteger(body.movimiento_id, "movimiento_id");
  const movement = await getAdminMovement(movementId, accessToken);
  const siteId = positiveInteger(movement.accesos?.nodos?.netbox_site_id, "netbox_site_id");
  const resource = String(body.recurso || "").toLowerCase();

  if (resource === "roles") {
    const data = await netboxRequest("/dcim/device-roles/?limit=500");
    return { ok: true, results: normalizeResults(data) };
  }
  if (resource === "racks") {
    const data = await netboxRequest(`/dcim/racks/?site_id=${siteId}&limit=500`);
    return { ok: true, results: normalizeResults(data) };
  }
  if (resource === "posiciones") {
    const positions = await availablePositions({
      rackId: positiveInteger(body.rack_id, "rack_id"),
      deviceTypeId: positiveInteger(body.device_type_id, "device_type_id"),
      siteId,
      ignoredDeviceId: body.equipo_retiro_id ? Number(body.equipo_retiro_id) : null,
    });
    return { ok: true, results: positions };
  }
  throw new HttpError(400, "Catalogo administrativo no permitido");
}

async function handleAdminRacksView(request, body) {
  const { accessToken } = await requireAdmin(request);
  const nodeId = positiveInteger(body.nodo_id, "nodo_id");
  const rows = await supabaseRequest(
    `/rest/v1/nodos?id=eq.${nodeId}&select=id,nombre,netbox_site_id`,
    { accessToken },
  );
  const node = Array.isArray(rows) ? rows[0] : null;
  if (!node) throw new HttpError(404, "El nodo no existe");
  const siteId = positiveInteger(node.netbox_site_id, "netbox_site_id");
  const resource = String(body.recurso || "").toLowerCase();

  if (resource === "racks") {
    const data = await netboxRequest(`/dcim/racks/?site_id=${siteId}&limit=500`);
    return { ok: true, results: normalizeResults(data) };
  }
  if (resource === "elevacion") {
    const rackId = positiveInteger(body.rack_id, "rack_id");
    await ensureRackAtSite(rackId, siteId);
    const data = await netboxRequest(`/dcim/racks/${rackId}/elevation/?face=front`);
    return { ok: true, results: normalizeResults(data) };
  }
  throw new HttpError(400, "Recurso de racks no permitido");
}

function compactDevice(device) {
  return {
    id: device.id,
    name: device.name,
    status: device.status,
    rack: device.rack,
    position: device.position,
    face: device.face,
  };
}

function restorePayload(snapshot) {
  return {
    status: entityValue(snapshot.status),
    rack: snapshot.rack?.id ?? null,
    position: snapshot.position ?? null,
    face: entityValue(snapshot.face) ?? null,
  };
}

async function validateInstallation(detail, siteId, oldDeviceId) {
  const name = String(detail.nombre_aprobado || "").trim();
  if (!name) throw new HttpError(400, "Falta confirmar el nombre del equipo");

  const [nameData, deviceType, role] = await Promise.all([
    netboxRequest(`/dcim/devices/?name=${encodeURIComponent(name)}&limit=1`),
    netboxRequest(`/dcim/device-types/${positiveInteger(detail.device_type_netbox_id, "device_type_netbox_id")}/`),
    netboxRequest(`/dcim/device-roles/${positiveInteger(detail.device_role_netbox_id, "device_role_netbox_id")}/`),
  ]);
  if (normalizeResults(nameData).length > 0) {
    throw new HttpError(409, `El nombre ${name} ya existe en NetBox`);
  }
  if (entityId(deviceType.manufacturer) !== Number(detail.manufacturer_netbox_id)) {
    throw new HttpError(400, `El modelo de ${name} ya no pertenece al fabricante solicitado`);
  }

  if (detail.es_rackeable) {
    const positions = await availablePositions({
      rackId: positiveInteger(detail.rack_aprobado_netbox_id, "rack_aprobado_netbox_id"),
      deviceTypeId: detail.device_type_netbox_id,
      siteId,
      ignoredDeviceId: oldDeviceId,
    });
    if (!positions.some((item) => item.position === Number(detail.ru_inicio_aprobada))) {
      throw new HttpError(409, `La RU seleccionada para ${name} ya no esta disponible`);
    }
  }
  return { deviceType, role };
}

async function createDevice(detail, siteId) {
  const payload = {
    name: detail.nombre_aprobado,
    device_type: detail.device_type_netbox_id,
    role: detail.device_role_netbox_id,
    site: siteId,
    status: activeStatus,
    serial: detail.serial || "",
  };
  if (detail.es_rackeable) {
    payload.rack = detail.rack_aprobado_netbox_id;
    payload.position = detail.ru_inicio_aprobada;
    payload.face = "front";
  }
  return netboxRequest("/dcim/devices/", { method: "POST", body: payload, write: true });
}

async function executeMovement(movement) {
  const siteId = positiveInteger(movement.accesos?.nodos?.netbox_site_id, "netbox_site_id");
  const actionOrder = { RETIRO: 0, INSTALACION: 1 };
  const details = [...(movement.movimiento_detalle || [])].sort(
    (a, b) =>
      a.numero_item - b.numero_item ||
      actionOrder[a.accion] - actionOrder[b.accion],
  );
  if (details.length === 0) throw new HttpError(400, "El movimiento no tiene detalles");

  const withdrawals = new Map(
    details.filter((item) => item.accion === "RETIRO").map((item) => [item.numero_item, item]),
  );
  const installations = details.filter((item) => item.accion === "INSTALACION");

  await Promise.all(installations.map((detail) =>
    validateInstallation(detail, siteId, withdrawals.get(detail.numero_item)?.equipo_anterior_netbox_id)
  ));

  const snapshots = new Map();
  for (const detail of withdrawals.values()) {
    const device = await netboxRequest(`/dcim/devices/${detail.equipo_anterior_netbox_id}/`);
    if (entityId(device.site) !== Number(siteId)) {
      throw new HttpError(409, `El equipo ${detail.equipo_anterior_nombre} ya no pertenece al nodo`);
    }
    snapshots.set(detail.id, device);
  }

  const compensations = [];
  const results = [];
  let rolledBack = false;
  const rollback = async () => {
    if (rolledBack) return;
    rolledBack = true;
    const rollbackErrors = [];
    for (const compensate of [...compensations].reverse()) {
      try {
        await compensate();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(`Fallo la compensacion: ${rollbackErrors.join(" | ")}`);
    }
  };
  try {
    for (const detail of details) {
      if (detail.accion === "RETIRO") {
        const snapshot = snapshots.get(detail.id);
        const updated = await netboxRequest(`/dcim/devices/${detail.equipo_anterior_netbox_id}/`, {
          method: "PATCH",
          body: { status: retiredStatus, rack: null, position: null, face: null },
          write: true,
        });
        compensations.push(() => netboxRequest(`/dcim/devices/${detail.equipo_anterior_netbox_id}/`, {
          method: "PATCH",
          body: restorePayload(snapshot),
          write: true,
        }));
        results.push({ detalle_id: detail.id, netbox_id: detail.equipo_anterior_netbox_id, respuesta: compactDevice(updated) });
      } else {
        const created = await createDevice(detail, siteId);
        compensations.push(() => netboxRequest(`/dcim/devices/${created.id}/`, {
          method: "DELETE",
          write: true,
        }));
        results.push({ detalle_id: detail.id, netbox_id: created.id, respuesta: compactDevice(created) });
      }
    }
    return { results, rollback };
  } catch (error) {
    try {
      await rollback();
    } catch (rollbackError) {
      throw new Error(`${error.message}. Ademas ${rollbackError.message}`);
    }
    throw error;
  }
}

async function handleProcessMovement(request, body) {
  if (!netboxWriteToken || isPlaceholder(netboxWriteToken)) {
    throw new HttpError(503, "Configure NETBOX_WRITE_TOKEN antes de procesar movimientos");
  }
  const { accessToken } = await requireAdmin(request);
  const movementId = positiveInteger(body.movimiento_id, "movimiento_id");
  const approvals = Array.isArray(body.aprobaciones) ? body.aprobaciones : [];

  try {
    try {
      await supabaseRequest("/rest/v1/rpc/recuperar_procesamientos_vencidos", {
        accessToken,
        method: "POST",
        body: {},
      });
    } catch (recoveryError) {
      console.error(
        "No se pudieron revisar procesamientos vencidos",
        recoveryError.message,
      );
    }

    await supabaseRequest("/rest/v1/rpc/preparar_procesamiento_movimiento", {
      accessToken,
      method: "POST",
      body: { p_movimiento_id: movementId, p_aprobaciones: approvals },
    });

    const movement = await getAdminMovement(movementId, accessToken);
    const execution = await executeMovement(movement);
    try {
      await supabaseRequest("/rest/v1/rpc/finalizar_procesamiento_movimiento", {
        accessToken,
        method: "POST",
        body: {
          p_movimiento_id: movementId,
          p_exito: true,
          p_resultados: execution.results,
          p_error: null,
        },
      });
    } catch (finalizeError) {
      let current;
      try {
        current = await getAdminMovement(movementId, accessToken);
      } catch {
        const uncertainError = new Error(
          "NetBox termino, pero no se pudo confirmar el estado en Supabase. No reintente hasta revisar ambos sistemas",
        );
        uncertainError.uncertainCommit = true;
        throw uncertainError;
      }
      if (current.estado !== "APROBADO") {
        await execution.rollback();
        throw finalizeError;
      }
    }
    return {
      ok: true,
      movimiento_id: movementId,
      estado: "APROBADO",
      resultados: execution.results,
    };
  } catch (error) {
    if (!error.uncertainCommit) {
      try {
        const current = await getAdminMovement(movementId, accessToken);
        if (current.estado === "PROCESANDO") {
          await supabaseRequest("/rest/v1/rpc/finalizar_procesamiento_movimiento", {
            accessToken,
            method: "POST",
            body: {
              p_movimiento_id: movementId,
              p_exito: false,
              p_resultados: [],
              p_error: error.message,
            },
          });
        }
      } catch (finalizeError) {
        console.error("No se pudo registrar el error en Supabase", finalizeError.message);
      }
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (request.method === "OPTIONS") {
    send(response, 200, { ok: true }, origin);
    return;
  }
  if (origin && !allowedOrigins.includes(origin)) {
    send(response, 403, { ok: false, error: "Origen no autorizado" }, origin);
    return;
  }
  if (request.method !== "POST") {
    send(response, 405, { ok: false, error: "Metodo no permitido" }, origin);
    return;
  }

  try {
    const body = await readJson(request);
    let result;
    if (request.url === "/api/netbox/consulta") {
      result = await handlePublicCatalog(body);
    } else if (request.url === "/api/netbox/admin/catalogo") {
      result = await handleAdminCatalog(request, body);
    } else if (request.url === "/api/netbox/admin/racks-view") {
      result = await handleAdminRacksView(request, body);
    } else if (request.url === "/api/netbox/admin/procesar") {
      result = await handleProcessMovement(request, body);
    } else {
      throw new HttpError(404, "Ruta no encontrada");
    }
    send(response, 200, result, origin);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("NetBox proxy error", { status, error: error.message });
    send(response, status, { ok: false, error: error.message || "Operacion fallida" }, origin);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`NetBox proxy disponible en http://127.0.0.1:${port}`);
  if (!netboxWriteToken || isPlaceholder(netboxWriteToken)) {
    console.log("Modo lectura: NETBOX_WRITE_TOKEN aun no esta configurado");
  }
});
