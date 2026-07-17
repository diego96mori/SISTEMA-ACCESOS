import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { sincronizarNodosNetbox } from "../services/equipos";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);
  const [sincronizandoNodos, setSincronizandoNodos] = useState(false);
  const [accesoSeleccionado, setAccesoSeleccionado] = useState(null);
  const [controlExistente, setControlExistente] = useState(false);
  const [editandoControl, setEditandoControl] = useState(false);
  const [control, setControl] = useState({
    hora_ingreso_real: "",
    hora_salida_real: "",
    estado_acceso: "EN_NODO",
  });

  const cargarAccesos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accesos")
      .select(`
        id,
        codigo_seguimiento,
        fecha_ingreso,
        fecha_salida,
        hora_ingreso,
        hora_salida,
        hora_ingreso_real,
        hora_salida_real,
        estado_acceso,
        estado_aprobacion,
        motivo_cancelacion,
        observacion_aprobacion,
        detalle_trabajo,
        trabajo_contrata,
        nombre_contrata,
        solicitante_nombre,
        solicitante_ap_paterno,
        solicitante_ap_materno,
        solicitante_num_doc,
        solicitante_telefono,
        solicitante_correo,
        nodos ( nombre ),
        empresas ( nombre ),
        tipos_trabajo ( nombre ),
        areas_responsable:area_responsable_id ( nombre ),
        personal_acceso (
          id,
          orden,
          nombre,
          ap_paterno,
          ap_materno,
          num_doc,
          telefono
        ),
        acceso_documentos (
          id,
          storage_path,
          nombre_original
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMensaje(`No se pudieron cargar las solicitudes: ${error.message}`);
    } else {
      setAccesos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const iniciar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/admin");
        return;
      }
      setUser(data.user);
      await cargarAccesos();
    };

    iniciar();
  }, [cargarAccesos, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const sincronizarNodos = async () => {
    try {
      setSincronizandoNodos(true);
      setMensaje("Sincronizando sites de NetBox...");
      const result = await sincronizarNodosNetbox();
      setMensaje(
        `Nodos sincronizados: ${result.total}. Nuevos: ${result.insertados}. Actualizados: ${result.actualizados}.`,
      );
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudieron sincronizar los nodos");
    } finally {
      setSincronizandoNodos(false);
    }
  };

  const resolverSolicitud = async (acceso, decision) => {
    if (acceso.estado_aprobacion !== "PENDIENTE") return;

    const observacion = decision === "CANCELADO"
      ? window.prompt("Indique el motivo de la cancelación:")
      : null;

    if (decision === "CANCELADO" && !observacion?.trim()) return;

    try {
      setProcesandoId(acceso.id);
      const { error } = await supabase.rpc("resolver_solicitud_acceso", {
        p_acceso_id: acceso.id,
        p_decision: decision,
        p_observacion: observacion,
      });

      if (error) throw error;

      setMensaje(
        decision === "APROBADO"
          ? "Solicitud aprobada correctamente"
          : "Solicitud cancelada correctamente",
      );
      await cargarAccesos();
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo resolver la solicitud");
    } finally {
      setProcesandoId(null);
    }
  };

  const abrirDocumento = async (documento) => {
    const { data, error } = await supabase.storage
      .from("sctr")
      .createSignedUrl(documento.storage_path, 60);

    if (error) {
      setMensaje(`No se pudo abrir ${documento.nombre_original}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const abrirControl = (acceso) => {
    if (acceso.estado_aprobacion !== "APROBADO") return;

    const tieneControl = Boolean(
      acceso.hora_ingreso_real ||
      acceso.hora_salida_real ||
      ["EN_NODO", "ATENDIDO"].includes(acceso.estado_acceso),
    );

    setAccesoSeleccionado(acceso);
    setControlExistente(tieneControl);
    setEditandoControl(!tieneControl);
    setControl({
      hora_ingreso_real: acceso.hora_ingreso_real || "",
      hora_salida_real: acceso.hora_salida_real || "",
      estado_acceso: ["EN_NODO", "ATENDIDO"].includes(acceso.estado_acceso)
        ? acceso.estado_acceso
        : "EN_NODO",
    });
  };

  const guardarControl = async () => {
    if (!accesoSeleccionado || !editandoControl) return;
    if (accesoSeleccionado.estado_aprobacion !== "APROBADO") {
      setMensaje("Solo una solicitud aprobada puede registrar el control de acceso");
      return;
    }
    if (!control.hora_ingreso_real) {
      setMensaje("Debe indicar la hora real de ingreso");
      return;
    }
    if (control.estado_acceso === "ATENDIDO" && !control.hora_salida_real) {
      setMensaje("Para marcar como atendido debe indicar la hora real de salida");
      return;
    }

    setProcesandoId(accesoSeleccionado.id);
    const { data, error } = await supabase
      .from("accesos")
      .update({
        hora_ingreso_real: control.hora_ingreso_real || null,
        hora_salida_real: control.hora_salida_real || null,
        estado_acceso: control.estado_acceso,
      })
      .eq("id", accesoSeleccionado.id)
      .eq("estado_aprobacion", "APROBADO")
      .select("id, hora_ingreso_real, hora_salida_real, estado_acceso")
      .maybeSingle();

    if (error) {
      setMensaje(error.message);
      setProcesandoId(null);
      return;
    }
    if (!data) {
      setMensaje("No se actualizó el control porque la solicitud no está aprobada");
      setProcesandoId(null);
      return;
    }

    setAccesoSeleccionado(null);
    setControlExistente(false);
    setEditandoControl(false);
    setMensaje(
      controlExistente
        ? "Control de acceso editado correctamente"
        : "Control de acceso guardado correctamente",
    );
    await cargarAccesos();
    setProcesandoId(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">WI-NET</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          Lista de Accesos
        </button>
        <button
          onClick={() => navigate("/equipos")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2"
        >
          Gestión Equipos
        </button>
          <button
            onClick={() => navigate("/racks")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2"
        >
            Vista de Racks
          </button>
          <button
            type="button"
            onClick={sincronizarNodos}
            disabled={sincronizandoNodos}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2 disabled:opacity-50"
          >
            {sincronizandoNodos ? "Sincronizando..." : "Sincronizar nodos NetBox"}
          </button>
      </aside>

      <main className="flex-1 p-8 overflow-hidden">
        {mensaje && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-900 rounded">
            {mensaje}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Lista de Accesos</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nodo</th>
                  <th className="p-3">Fecha y hora</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Empresa / Área</th>
                  <th className="p-3">Trabajo</th>
                  <th className="p-3">Personal que ingresará</th>
                  <th className="p-3">SCTR</th>
                  <th className="p-3">Aprobación</th>
                  <th className="p-3">Acceso</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accesos.map((acceso) => (
                  <tr key={acceso.id} className="border-t hover:bg-blue-50">
                    <td className="p-3">{acceso.id}</td>
                    <td className="p-3 max-w-48 truncate" title={acceso.codigo_seguimiento}>
                      {acceso.codigo_seguimiento}
                    </td>
                    <td className="p-3">{acceso.nodos?.nombre}</td>
                    <td className="p-3">
                      {acceso.fecha_ingreso} {acceso.hora_ingreso}
                    </td>
                    <td className="p-3">
                      <strong>
                        {acceso.solicitante_nombre} {acceso.solicitante_ap_paterno}
                      </strong>
                      <div className="text-xs text-gray-500">
                        {acceso.solicitante_num_doc} · {acceso.solicitante_telefono}
                      </div>
                    </td>
                    <td className="p-3">
                      {acceso.empresas?.nombre}
                      <div className="text-xs text-gray-500">
                        {acceso.areas_responsable?.nombre}
                      </div>
                    </td>
                    <td className="p-3 max-w-56">
                      {acceso.tipos_trabajo?.nombre}
                      <div className="truncate text-xs text-gray-500">
                        {acceso.detalle_trabajo}
                      </div>
                    </td>
                    <td className="p-3">
                      {[...(acceso.personal_acceso ?? [])]
                        .sort((a, b) => a.orden - b.orden)
                        .map((persona) => (
                        <div key={persona.id} className="text-xs mb-2 last:mb-0 min-w-52">
                          <strong>
                            {persona.orden}) {persona.nombre} {persona.ap_paterno} {persona.ap_materno}
                          </strong>
                          <div className="text-gray-500">
                            Doc. {persona.num_doc} · Tel. {persona.telefono}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      {acceso.acceso_documentos?.map((documento) => (
                        <button
                          key={documento.id}
                          type="button"
                          title={documento.nombre_original}
                          className="text-xl mr-2"
                          onClick={() => abrirDocumento(documento)}
                        >
                          📄
                        </button>
                      ))}
                    </td>
                    <td className="p-3">
                      <strong>{acceso.estado_aprobacion}</strong>
                      {acceso.observacion_aprobacion && (
                        <div className="text-xs text-red-600">
                          {acceso.observacion_aprobacion}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{acceso.estado_acceso}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            acceso.estado_aprobacion !== "PENDIENTE" ||
                            procesandoId === acceso.id
                          }
                          onClick={() => resolverSolicitud(acceso, "APROBADO")}
                          className="px-2 py-1 rounded bg-green-600 text-white disabled:opacity-40"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={
                            acceso.estado_aprobacion !== "PENDIENTE" ||
                            procesandoId === acceso.id
                          }
                          onClick={() => resolverSolicitud(acceso, "CANCELADO")}
                          className="px-2 py-1 rounded bg-red-600 text-white disabled:opacity-40"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={
                            acceso.estado_aprobacion !== "APROBADO" ||
                            procesandoId === acceso.id
                          }
                          onClick={() => abrirControl(acceso)}
                          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Control
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

      {accesoSeleccionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-4">Control de Acceso</h2>

            <label>Hora ingreso real</label>
            <input
              type="time"
              value={control.hora_ingreso_real}
              disabled={!editandoControl}
              onChange={(event) => setControl((prev) => ({
                ...prev,
                hora_ingreso_real: event.target.value,
              }))}
              className="w-full border p-2 mb-3 disabled:bg-gray-100 disabled:text-gray-600"
            />

            <label>Hora salida real</label>
            <input
              type="time"
              value={control.hora_salida_real}
              disabled={!editandoControl}
              onChange={(event) => setControl((prev) => ({
                ...prev,
                hora_salida_real: event.target.value,
              }))}
              className="w-full border p-2 mb-3 disabled:bg-gray-100 disabled:text-gray-600"
            />

            <label>Estado</label>
            <select
              value={control.estado_acceso}
              disabled={!editandoControl}
              onChange={(event) => setControl((prev) => ({
                ...prev,
                estado_acceso: event.target.value,
              }))}
              className="w-full border p-2 mb-4 disabled:bg-gray-100 disabled:text-gray-600"
            >
              <option>EN_NODO</option>
              <option>ATENDIDO</option>
            </select>

            <div className="flex justify-between">
              <button
                onClick={() => setAccesoSeleccionado(null)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cerrar
              </button>
              {editandoControl ? (
                <button
                  onClick={guardarControl}
                  disabled={procesandoId === accesoSeleccionado.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40"
                >
                  {procesandoId === accesoSeleccionado.id ? "Guardando..." : "Guardar"}
                </button>
              ) : (
                <button
                  onClick={() => setEditandoControl(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
