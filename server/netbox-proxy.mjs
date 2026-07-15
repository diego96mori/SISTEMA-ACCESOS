import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const netboxUrl = String(process.env.NETBOX_URL || "").replace(/\/$/, "");
const netboxToken = String(process.env.NETBOX_TOKEN || "");
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const hasPlaceholder = [netboxToken, supabaseKey].some((value) =>
  /REEMPLAZAR|PEGA_AQUI/i.test(value),
);

if (!netboxUrl || !netboxToken || !supabaseUrl || !supabaseKey || hasPlaceholder) {
  console.error(
    "Falta completar .env.netbox.local con NETBOX_TOKEN y SUPABASE_PUBLISHABLE_KEY reales",
  );
  process.exit(1);
}

function send(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin":
      origin && allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32 * 1024) throw new Error("Solicitud demasiado grande");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} no es válido`);
  }
  return parsed;
}

async function getContext(codigo) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/obtener_contexto_equipos`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_codigo: codigo }),
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo validar el código en Supabase");
  }

  const rows = await response.json();
  const context = Array.isArray(rows) ? rows[0] : rows;
  if (!context) throw new Error("La solicitud no está autorizada para equipos");
  return context;
}

function endpointFor(resource, body, siteId) {
  switch (resource) {
    case "equipos":
      return `/dcim/devices/?site_id=${siteId}&limit=500`;
    case "fabricantes":
      return "/dcim/manufacturers/?limit=500";
    case "modelos": {
      const manufacturerId = positiveInteger(body.fabricante_id, "fabricante_id");
      return `/dcim/device-types/?manufacturer_id=${manufacturerId}&limit=500`;
    }
    case "racks":
      return `/dcim/racks/?site_id=${siteId}&limit=500`;
    case "nombre": {
      const name = String(body.nombre || "").trim();
      if (!name || name.length > 100) throw new Error("El nombre no es válido");
      return `/dcim/devices/?name=${encodeURIComponent(name)}&limit=1`;
    }
    default:
      throw new Error("Recurso de NetBox no permitido");
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (request.method === "OPTIONS") {
    send(response, 200, { ok: true }, origin);
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/netbox/consulta") {
    send(response, 404, { ok: false, error: "Ruta no encontrada" }, origin);
    return;
  }

  if (origin && !allowedOrigins.includes(origin)) {
    send(response, 403, { ok: false, error: "Origen no autorizado" }, origin);
    return;
  }

  try {
    const body = await readJson(request);
    const codigo = String(body.codigo || "").trim();
    const resource = String(body.recurso || "").trim().toLowerCase();
    if (!codigo) throw new Error("Falta el código de seguimiento");

    const context = await getContext(codigo);
    const siteId = positiveInteger(context.netbox_site_id, "netbox_site_id");
    const endpoint = endpointFor(resource, body, siteId);
    const netboxResponse = await fetch(`${netboxUrl}${endpoint}`, {
      headers: {
        Authorization: `Token ${netboxToken}`,
        Accept: "application/json",
      },
    });

    if (!netboxResponse.ok) {
      console.error("NetBox response", netboxResponse.status, resource);
      throw new Error("NetBox rechazó la consulta");
    }

    const data = await netboxResponse.json();
    send(response, 200, { ok: true, results: data.results || [] }, origin);
  } catch (error) {
    console.error("NetBox proxy error", error.message);
    send(
      response,
      400,
      { ok: false, error: error.message || "No se pudo consultar NetBox" },
      origin,
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`NetBox proxy disponible en http://127.0.0.1:${port}`);
});
