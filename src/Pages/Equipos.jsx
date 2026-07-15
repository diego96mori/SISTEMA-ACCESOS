import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { denegarMovimientoEquipos } from "../services/equipos";

function detailTitle(detail) {
  return detail.accion === "RETIRO"
    ? detail.equipo_anterior_nombre
    : detail.nombre_aprobado || detail.nombre_propuesto;
}

function Equipos() {
  const navigate = useNavigate();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargarMovimientos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("movimientos")
      .select(`
        id,
        acceso_id,
        tipo_movimiento,
        cantidad_items,
        estado,
        observacion_admin,
        error_general,
        aprobado_por,
        fecha_aprobacion,
        created_at,
        accesos (
          id,
          codigo_seguimiento,
          fecha_ingreso,
          solicitante_nombre,
          solicitante_ap_paterno,
          nodos ( nombre, netbox_site_id )
        ),
        movimiento_detalle (
          id,
          numero_item,
          grupo_reemplazo,
          accion,
          es_rackeable,
          equipo_anterior_netbox_id,
          equipo_anterior_nombre,
          equipo_anterior_fabricante,
          equipo_anterior_modelo,
          equipo_anterior_serial,
          equipo_anterior_rack_netbox_id,
          equipo_anterior_rack_nombre,
          equipo_anterior_ru_inicio,
          equipo_anterior_cantidad_ru,
          manufacturer_netbox_id,
          device_type_netbox_id,
          fabricante,
          modelo,
          serial,
          nombre_propuesto,
          nombre_aprobado,
          rack_aprobado_netbox_id,
          rack_aprobado_nombre,
          ru_inicio_aprobada,
          cantidad_ru,
          equipo_resultado_netbox_id,
          estado_ejecucion,
          error_netbox
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMensaje(`No se pudieron cargar los movimientos: ${error.message}`);
      setMovimientos([]);
    } else {
      setMovimientos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const denegar = async (movimiento) => {
    const motivo = window.prompt("Indique el motivo de la denegación:");
    if (!motivo?.trim()) return;

    try {
      setProcesandoId(movimiento.id);
      await denegarMovimientoEquipos(movimiento.id, motivo);
      setMensaje("Solicitud de equipos denegada correctamente");
      setSeleccionado(null);
      await cargarMovimientos();
    } catch (error) {
      console.error(error);
      setMensaje(error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">WI-NET</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200"
        >
          Lista de Accesos
        </button>
        <button className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2">
          Gestión Equipos
        </button>
        <button
          onClick={() => navigate("/racks")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2"
        >
          Vista de Racks
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-hidden">
        <h1 className="text-2xl font-semibold mb-6">Gestión de Equipos</h1>
        {mensaje && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-900 rounded">
            {mensaje}
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Movimiento</th>
                  <th className="p-4">Código</th>
                  <th className="p-4">Nodo</th>
                  <th className="p-4">Solicitante</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="border-b hover:bg-blue-50">
                    <td className="p-4">{movimiento.id}</td>
                    <td className="p-4 max-w-48 truncate" title={movimiento.accesos?.codigo_seguimiento}>
                      {movimiento.accesos?.codigo_seguimiento}
                    </td>
                    <td className="p-4">{movimiento.accesos?.nodos?.nombre}</td>
                    <td className="p-4">
                      {movimiento.accesos?.solicitante_nombre}{" "}
                      {movimiento.accesos?.solicitante_ap_paterno}
                    </td>
                    <td className="p-4 font-semibold">{movimiento.tipo_movimiento}</td>
                    <td className="p-4">{movimiento.cantidad_items}</td>
                    <td className="p-4">{movimiento.accesos?.fecha_ingreso}</td>
                    <td className="p-4">
                      <strong>{movimiento.estado}</strong>
                      {movimiento.error_general && (
                        <div className="text-xs text-red-600">{movimiento.error_general}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          className="bg-blue-600 text-white px-3 py-1 rounded"
                          onClick={() => setSeleccionado(movimiento)}
                        >
                          Revisar
                        </button>
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-40"
                          disabled={
                            !["PENDIENTE", "EN_REVISION"].includes(movimiento.estado) ||
                            procesandoId === movimiento.id
                          }
                          onClick={() => denegar(movimiento)}
                        >
                          Denegar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {seleccionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-2">
              Movimiento {seleccionado.id} · {seleccionado.tipo_movimiento}
            </h2>
            <p className="mb-4">
              Código: {seleccionado.accesos?.codigo_seguimiento}
            </p>

            <div className="space-y-3">
              {seleccionado.movimiento_detalle
                ?.sort((a, b) =>
                  a.numero_item - b.numero_item || a.accion.localeCompare(b.accion)
                )
                .map((detail) => (
                  <div key={detail.id} className="border rounded-lg p-4">
                    <h3 className="font-bold">
                      Item {detail.numero_item} · {detail.accion}
                    </h3>
                    <p><strong>Equipo:</strong> {detailTitle(detail)}</p>
                    <p>
                      <strong>Condición:</strong>{" "}
                      {detail.es_rackeable ? "Rackeable" : "No rackeable"}
                    </p>
                    {detail.accion === "RETIRO" ? (
                      <>
                        <p><strong>NetBox ID:</strong> {detail.equipo_anterior_netbox_id}</p>
                        <p>
                          <strong>Fabricante / modelo:</strong>{" "}
                          {detail.equipo_anterior_fabricante} / {detail.equipo_anterior_modelo}
                        </p>
                        <p>
                          <strong>Rack / RU:</strong>{" "}
                          {detail.equipo_anterior_rack_nombre || "-"} / {detail.equipo_anterior_ru_inicio || "-"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p><strong>Fabricante:</strong> {detail.fabricante}</p>
                        <p><strong>Modelo:</strong> {detail.modelo}</p>
                        <p><strong>Nombre propuesto:</strong> {detail.nombre_propuesto}</p>
                        <p><strong>RU requeridas:</strong> {detail.cantidad_ru}</p>
                      </>
                    )}
                    <p><strong>Ejecución:</strong> {detail.estado_ejecucion}</p>
                    {detail.error_netbox && (
                      <p className="text-red-600">{detail.error_netbox}</p>
                    )}
                  </div>
                ))}
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={() => setSeleccionado(null)}
              >
                Cerrar
              </button>
              <div className="flex gap-2">
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-40"
                  disabled={
                    !["PENDIENTE", "EN_REVISION"].includes(seleccionado.estado) ||
                    procesandoId === seleccionado.id
                  }
                  onClick={() => denegar(seleccionado)}
                >
                  Denegar
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded opacity-50 cursor-not-allowed"
                  disabled
                  title="Se habilitará al desplegar el procesador seguro de NetBox"
                >
                  Proceder con NetBox
                </button>
              </div>
            </div>

            <p className="text-sm text-orange-700 mt-3">
              La aprobación permanece bloqueada hasta desplegar el procesador seguro de NetBox.
              React ya no elimina ni crea equipos directamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipos;
