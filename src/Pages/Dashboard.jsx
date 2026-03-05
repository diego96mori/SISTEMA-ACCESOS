import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Dashboard() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [accesoSeleccionado, setAccesoSeleccionado] = useState(null);

  const [ingresoReal, setIngresoReal] = useState("");
  const [salidaReal, setSalidaReal] = useState("");
  const [estadoAcceso, setEstadoAcceso] = useState("PENDIENTE");
  const [motivoCancelacion, setMotivoCancelacion] = useState("");



  useEffect(() => {
    verificarSesion();
    cargarAccesos();
  }, []);



  const verificarSesion = async () => {

    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      navigate("/");
      return;
    }

    setUser(data.user);

  };



  const cargarAccesos = async () => {

    const { data, error } = await supabase
      .from("accesos")
      .select(`
        id,
        fecha_ingreso,
        hora_ingreso,
        hora_ingreso_real,
        hora_salida_real,
        estado_acceso,
        motivo_cancelacion,
        detalle_trabajo,
        trabajo_contrata,
        nombre_contrata,
        sctr_path,

        solicitante_nombre,
        solicitante_ap_paterno,
        solicitante_num_doc,
        solicitante_telefono,
        solicitante_correo,

        nodos ( nombre ),
        empresas ( nombre ),
        tipos_trabajo ( nombre ),
        tipos_documento:solicitante_tipo_doc_id ( nombre ),
        areas_responsable:area_responsable_id ( nombre ),

        personal_acceso (
          nombre,
          ap_paterno,
          ap_materno,
          num_doc,
          telefono
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      console.log(error.message);
    }

    setAccesos(data || []);
    setLoading(false);

  };



  const handleLogout = async () => {

    await supabase.auth.signOut();
    navigate("/");

  };



  const abrirModal = (acceso) => {

    setAccesoSeleccionado(acceso);

    setIngresoReal(acceso.hora_ingreso_real || "");
    setSalidaReal(acceso.hora_salida_real || "");
    setEstadoAcceso(acceso.estado_acceso || "PENDIENTE");
    setMotivoCancelacion(acceso.motivo_cancelacion || "");

    setMostrarModal(true);

  };



  const guardarControl = async () => {

    await supabase
      .from("accesos")
      .update({
        hora_ingreso_real: ingresoReal,
        hora_salida_real: salidaReal,
        estado_acceso: estadoAcceso,
        motivo_cancelacion: motivoCancelacion
      })
      .eq("id", accesoSeleccionado.id);

    setMostrarModal(false);
    cargarAccesos();

  };



  const obtenerSctr = (path) => {

    const { data } = supabase
      .storage
      .from("sctr")
      .getPublicUrl(path);

    return data.publicUrl;

  };



  return (

    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}

      <aside className="w-64 bg-white shadow-lg p-6">

        <h2 className="text-xl font-bold mb-6">WI-NET</h2>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          Lista de Accesos
        </button>

      </aside>



      {/* MAIN */}

      <div className="flex-1 p-8">

        <div className="flex justify-between items-center mb-6">

          <div>
            <h1 className="text-2xl font-semibold">Lista de Accesos</h1>
            {user && (
              <p className="text-sm text-gray-500">{user.email}</p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Cerrar sesión
          </button>

        </div>



        <div className="bg-white rounded-xl shadow overflow-auto">

          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (

            <table className="min-w-full text-sm border-separate border-spacing-y-2">

              <thead className="bg-gray-100 sticky top-0">

                <tr>

                  <th className="p-4">ID</th>
                  <th className="p-4">Nodo</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Hora</th>
                  <th className="p-4">Solicitante</th>
                  <th className="p-4">Documento</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Empresa</th>
                  <th className="p-4">Área</th>
                  <th className="p-4">Trabajo</th>
                  <th className="p-4">Detalle</th>
                  <th className="p-4">Contrata</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Ingreso</th>
                  <th className="p-4">Salida</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">SCTR</th>
                  <th className="p-4">Personal</th>

                </tr>

              </thead>



              <tbody>

                {accesos.map((a) => (

                  <tr
                    key={a.id}
                    onClick={() => abrirModal(a)}
                    className="bg-white hover:bg-gray-50 shadow-sm cursor-pointer"
                  >

                    <td className="p-4">{a.id}</td>
                    <td className="p-4">{a.nodos?.nombre}</td>
                    <td className="p-4">{a.fecha_ingreso}</td>
                    <td className="p-4">{a.hora_ingreso}</td>

                    <td className="p-4">
                      {a.solicitante_nombre} {a.solicitante_ap_paterno}
                    </td>

                    <td className="p-4">{a.solicitante_num_doc}</td>
                    <td className="p-4">{a.solicitante_telefono}</td>
                    <td className="p-4">{a.empresas?.nombre}</td>
                    <td className="p-4">{a.areas_responsable?.nombre}</td>
                    <td className="p-4">{a.tipos_trabajo?.nombre}</td>
                    <td className="p-4">{a.detalle_trabajo}</td>

                    <td className="p-4">
                      {a.trabajo_contrata ? "SI" : "NO"}
                    </td>

                    <td className="p-4">
                      {a.trabajo_contrata ? a.nombre_contrata : "-"}
                    </td>

                    <td className="p-4">{a.hora_ingreso_real}</td>
                    <td className="p-4">{a.hora_salida_real}</td>
                    <td className="p-4">{a.estado_acceso}</td>
                    <td className="p-4">{a.motivo_cancelacion}</td>



                    <td className="p-4 text-center">

                      {a.sctr_path &&  (
                        <a
  href={obtenerSctr(a.sctr_path)}
  target="_blank"
  rel="noreferrer"
  className="text-blue-600 hover:text-blue-800 text-xl"
>
📄
</a>
                      )}

                    </td>



                    <td className="p-4">

                      {a.personal_acceso?.map((p, i) => (

                        <div
                          key={i}
                          className="mb-2 p-2 bg-gray-50 rounded border"
                        >

                          <div className="font-semibold">
                            {p.nombre} {p.ap_paterno}
                          </div>

                          <div className="text-xs text-gray-500">
                            DNI: {p.num_doc}
                          </div>

                          <div className="text-xs">
                            {p.telefono}
                          </div>

                        </div>

                      ))}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      </div>



      {/* MODAL */}

      {mostrarModal && (

        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">

          <div className="bg-white p-6 rounded-xl w-96">

            <h2 className="text-lg font-bold mb-4">
              Control de Acceso
            </h2>

            <label>Hora ingreso real</label>

            <input
              type="time"
              value={ingresoReal}
              onChange={(e) => setIngresoReal(e.target.value)}
              className="w-full border p-2 mb-3"
            />

            <label>Hora salida real</label>

            <input
              type="time"
              value={salidaReal}
              onChange={(e) => setSalidaReal(e.target.value)}
              className="w-full border p-2 mb-3"
            />

            <label>Estado Acceso</label>

            <select
              value={estadoAcceso}
              onChange={(e) => setEstadoAcceso(e.target.value)}
              className="w-full border p-2 mb-3"
            >

              <option>PENDIENTE</option>
              <option>EN_NODO</option>
              <option>ATENDIDO</option>
              <option>CANCELADO</option>

            </select>


            <label>Motivo cancelación</label>

            <input
              type="text"
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              className="w-full border p-2 mb-3"
            />



            <div className="flex justify-between">

              <button
                onClick={() => setMostrarModal(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cerrar
              </button>

              <button
                onClick={guardarControl}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Guardar
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

export default Dashboard;

