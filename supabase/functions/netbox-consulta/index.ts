import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@^2/cors";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return {
    ...sdkCorsHeaders,
    "Access-Control-Allow-Origin":
      origin && allowedOrigins().includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function secretKey(): string | undefined {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.default === "string") return parsed.default;
    } catch {
      // Legacy projects use SUPABASE_SERVICE_ROLE_KEY.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} no es valido`);
  }
  return parsed;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  try {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins().includes(origin)) {
      throw new HttpError(403, "Origen no autorizado");
    }

    if (request.method !== "POST") {
      throw new HttpError(405, "Metodo no permitido");
    }

    const body = await request.json();
    const codigo = String(body.codigo ?? "").trim();
    const recurso = String(body.recurso ?? "").trim().toLowerCase();
    if (!codigo) throw new HttpError(400, "Falta el codigo de seguimiento");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = secretKey();
    const netboxUrl = (Deno.env.get("NETBOX_URL") ?? "").replace(/\/$/, "");
    const netboxToken = Deno.env.get("NETBOX_TOKEN");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Falta la configuracion interna de Supabase");
    }
    if (!netboxUrl || !netboxToken) {
      throw new HttpError(503, "La integracion con NetBox no esta configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: contextRows, error: contextError } = await supabaseAdmin.rpc(
      "obtener_contexto_equipos",
      { p_codigo: codigo },
    );

    if (contextError) throw new HttpError(400, contextError.message);
    const context = Array.isArray(contextRows) ? contextRows[0] : contextRows;
    if (!context) throw new HttpError(403, "La solicitud no esta autorizada");

    const siteId = positiveInteger(context.netbox_site_id, "netbox_site_id");
    let endpoint: string;

    switch (recurso) {
      case "equipos":
        endpoint = `/dcim/devices/?site_id=${siteId}&limit=500`;
        break;
      case "fabricantes":
        endpoint = "/dcim/manufacturers/?limit=500";
        break;
      case "modelos": {
        const fabricanteId = positiveInteger(
          body.fabricante_id,
          "fabricante_id",
        );
        endpoint =
          `/dcim/device-types/?manufacturer_id=${fabricanteId}&limit=500`;
        break;
      }
      case "racks":
        endpoint = `/dcim/racks/?site_id=${siteId}&limit=500`;
        break;
      case "nombre": {
        const nombre = String(body.nombre ?? "").trim();
        if (!nombre || nombre.length > 100) {
          throw new HttpError(400, "El nombre no es valido");
        }
        endpoint = `/dcim/devices/?name=${encodeURIComponent(nombre)}&limit=1`;
        break;
      }
      default:
        throw new HttpError(400, "Recurso de NetBox no permitido");
    }

    const response = await fetch(`${netboxUrl}${endpoint}`, {
      headers: {
        Authorization: `Token ${netboxToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("NetBox read failed", {
        recurso,
        status: response.status,
      });
      throw new HttpError(502, "No se pudo consultar NetBox");
    }

    const result = await response.json();
    return json(request, { ok: true, results: result.results ?? [] });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError
      ? error.message
      : "No se pudo completar la consulta";
    console.error("netbox-consulta failed", {
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return json(request, { ok: false, error: message }, status);
  }
});
