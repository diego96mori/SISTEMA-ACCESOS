import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_REQUEST_SIZE = 32 * 1024 * 1024;

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

function supabaseSecretKey(): string | undefined {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;

      if (typeof defaultKey === "string" && defaultKey) {
        return defaultKey;
      }
    } catch {
      // Keep the legacy fallback while projects migrate to the new key format.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function requestCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();

  return {
    ...sdkCorsHeaders,
    "Access-Control-Allow-Origin":
      origin && allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: requestCorsHeaders(request),
  });
}

function assertOriginAllowed(request: Request): void {
  const origin = request.headers.get("origin");

  // Requests made by server-side tools may not include Origin. Browser
  // requests must come from one of the configured frontend origins.
  if (origin && !allowedOrigins().includes(origin)) {
    throw new HttpError(403, "Origen no autorizado");
  }
}

function parseJsonField(formData: FormData, name: string): unknown {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Falta el campo ${name}`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, `El campo ${name} no contiene JSON valido`);
  }
}

function safeFilename(filename: string): string {
  const normalized = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);

  return normalized || "documento.pdf";
}

function safeDatabaseMessage(message: string): string {
  const allowedFragments = [
    "datos del acceso",
    "personal",
    "documentos",
    "solicitud debe incluir",
    "identificadores del acceso",
    "nodo o el tipo de trabajo",
    "empresa no es valida",
    "area responsable",
    "area de apoyo",
    "tipo de documento",
    "nivel de acceso",
    "datos del solicitante",
    "correo del solicitante",
    "datos de la persona",
    "solo se permiten documentos pdf",
    "documento supera",
  ];
  const normalized = message.toLowerCase();

  return allowedFragments.some((fragment) => normalized.includes(fragment))
    ? message
    : "Los datos enviados no son validos";
}

async function assertPdf(file: File): Promise<void> {
  if (file.size < 5 || file.size > MAX_FILE_SIZE) {
    throw new HttpError(400, `El archivo ${file.name} supera el limite de 10 MiB`);
  }

  if (file.type !== "application/pdf") {
    throw new HttpError(400, `El archivo ${file.name} no es PDF`);
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const header = new TextDecoder().decode(signature);

  if (header !== "%PDF-") {
    throw new HttpError(400, `El archivo ${file.name} no contiene un PDF valido`);
  }
}

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: requestCorsHeaders(request) });
  }

  const uploadedPaths: string[] = [];
  let databaseCommitted = false;

  try {
    assertOriginAllowed(request);

    if (request.method !== "POST") {
      throw new HttpError(405, "Metodo no permitido");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new HttpError(415, "Se esperaba multipart/form-data");
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw new HttpError(413, "La solicitud supera el limite permitido");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = supabaseSecretKey();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan variables internas de Supabase");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const formData = await request.formData();
    const acceso = parseJsonField(formData, "acceso");
    const personal = parseJsonField(formData, "personal");
    const files = formData
      .getAll("archivos")
      .filter((value): value is File => value instanceof File);

    if (files.length < 1 || files.length > MAX_FILES) {
      throw new HttpError(400, "Debes adjuntar entre 1 y 3 documentos PDF");
    }

    const uploadGroup = crypto.randomUUID();
    const documentos: Array<{
      storage_path: string;
      nombre_original: string;
      mime_type: string;
      size_bytes: number;
    }> = [];

    for (const file of files) {
      await assertPdf(file);

      const path = `solicitudes/${uploadGroup}/${crypto.randomUUID()}_${safeFilename(file.name)}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("sctr")
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`No se pudo guardar un documento: ${uploadError.message}`);
      }

      uploadedPaths.push(path);
      documentos.push({
        storage_path: path,
        nombre_original: file.name.slice(0, 255),
        mime_type: "application/pdf",
        size_bytes: file.size,
      });
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "crear_solicitud_acceso_interna",
      {
        p_acceso: acceso,
        p_personal: personal,
        p_documentos: documentos,
      },
    );

    if (rpcError) {
      throw new HttpError(400, safeDatabaseMessage(rpcError.message));
    }

    databaseCommitted = true;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.codigo_seguimiento) {
      throw new Error("La base no devolvio el codigo de seguimiento");
    }

    return jsonResponse(request, {
      ok: true,
      codigo_seguimiento: result.codigo_seguimiento,
      requiere_equipos: result.requiere_equipos,
      requiere_llave: result.requiere_llave,
    }, 201);
  } catch (error) {
    if (!databaseCommitted && uploadedPaths.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = supabaseSecretKey();

        if (supabaseUrl && serviceRoleKey) {
          const cleanupClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await cleanupClient.storage.from("sctr").remove(uploadedPaths);
        }
      } catch (cleanupError) {
        console.error("SCTR cleanup failed", { requestId, cleanupError });
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError
      ? error.message
      : "No se pudo registrar la solicitud";

    console.error("registrar-acceso failed", {
      requestId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(request, {
      ok: false,
      error: message,
      request_id: requestId,
    }, status);
  }
});
