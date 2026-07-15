import {
  registrarAccesoUrl,
  supabase,
} from "../supabaseClient";

const catalogQueries = [
  ["nodos", "id, nombre, requiere_llave, netbox_site_id"],
  ["tipos_documento", "id, nombre"],
  ["niveles_acceso", "id, nombre"],
  ["empresas", "id, nombre"],
  ["areas", "id, empresa_id, nombre"],
  ["tipos_trabajo", "id, nombre, gestiona_equipos"],
];

export async function cargarCatalogosPublicos() {
  const responses = await Promise.all(
    catalogQueries.map(([table, columns]) =>
      supabase.from(table).select(columns).order("nombre"),
    ),
  );

  const failed = responses.find(({ error }) => error);
  if (failed?.error) {
    throw new Error(`No se pudieron cargar los catalogos: ${failed.error.message}`);
  }

  const [nodos, tiposDoc, niveles, empresas, areas, tiposTrabajo] =
    responses.map(({ data }) => data ?? []);

  return { nodos, tiposDoc, niveles, empresas, areas, tiposTrabajo };
}

export async function registrarSolicitudAcceso({ acceso, personal, archivos }) {
  const payload = new FormData();
  payload.append("acceso", JSON.stringify(acceso));
  payload.append("personal", JSON.stringify(personal));

  archivos.forEach((archivo) => {
    payload.append("archivos", archivo, archivo.name);
  });

  const response = await fetch(registrarAccesoUrl, {
    method: "POST",
    body: payload,
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("La funcion de registro no devolvio una respuesta valida");
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "No se pudo registrar la solicitud");
  }

  return result;
}
