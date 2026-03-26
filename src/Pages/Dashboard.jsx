import { useEffect, useState } from "react";
import { supabase, supabaseAnonKey } from "../supabaseClient";
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

  const [acciones, setAcciones] = useState({});
  const [mensaje, setMensaje] = useState("");


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
        estado_aprobacion,
        sctr_path,

        solicitante_nombre,
        solicitante_ap_paterno,
        solicitante_ap_materno,
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

    const accionesIniciales = {};
    (data || []).forEach(a => {
    accionesIniciales[a.id] = a.estado_aprobacion;
    });
setAcciones(accionesIniciales);
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
const manejarAccion = async (id, tipo, correo) => {

  if (acciones[id] === "APROBADO" || acciones[id] === "DENEGADO") return;

  setAcciones(prev => ({
    ...prev,
    [id]: tipo
  }));

  try {

    await supabase
      .from("accesos")
      .update({ estado_aprobacion: tipo })
      .eq("id", id);
console.log("KEY:", supabaseAnonKey);
    const res = await fetch(
      "https://stkgsygonyxtrdhlgusx.supabase.co/functions/v1/super-endpoint",
      {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${supabaseAnonKey}`,
  "apikey": supabaseAnonKey
},
        body: JSON.stringify({
          correo: correo,
          estado: tipo
        })
      }
    );

    const data = await res.json();

    console.log("RESPUESTA CORREO:", data);

    // 🔥 VALIDACIÓN REAL
    if (res.ok) {
      setMensaje("✅ Correo enviado correctamente");
    } else {
      setMensaje("❌ Error al enviar correo");}
     setTimeout(() => {
    setMensaje("");
  }, 3000);


  } catch (error) {
  console.error("ERROR:", error);
  setMensaje("❌ Error de conexión con el servidor");

  setTimeout(() => {
    setMensaje("");
  }, 3000);
}

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
        <button
  onClick={() => navigate("/equipos")}
  className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2"
>
  Gestión Equipos
</button>

  <button
          className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2"
        >
          Gestión Equipos
        </button>


      </aside>



      {/* MAIN */}

      <div className="flex-1 p-8">
              {mensaje && (
  <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
    {mensaje}
  </div>
)}

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



        <div className="bg-white rounded-xl shadow overflow-x-auto">

          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (

           <table className="min-w-full text-sm border-separate border-spacing-y-2 whitespace-nowrap">

             <thead className="bg-gray-100 sticky top-0 text-gray-700 text-xs uppercase">

                <tr>

                  <th className="p-4">ID</th>
                  <th className="p-4 min-w-[140px]">Nodo</th>
                  <th className="p-4 min-w-[120px]">Fecha</th>
                  <th className="p-4 min-w-[100px]">Hora</th>
                  <th className="p-4 min-w-[220px]">Solicitante</th>
                  <th className="p-4">Documento</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4 min-w-[140px]">Empresa</th>
                  <th className="p-4 min-w-[160px]">Área</th>
                  <th className="p-4 min-w-[160px]">Trabajo</th>
                  <th className="p-4 min-w-[200px]">Detalle</th>
                  <th className="p-4">Contrata</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Ingreso</th>
                  <th className="p-4">Salida</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">SCTR</th>
                  <th className="p-4 min-w-[200px]">Personal</th>
                  <th className="p-4">Acción</th>

                </tr>

              </thead>



              <tbody>

                {accesos.map((a) => (

                  <tr
  key={a.id}
  onClick={() => abrirModal(a)}
  className="bg-white hover:bg-blue-50 shadow-sm cursor-pointer transition"
>

                    <td className="p-4">{a.id}</td>
                    <td className="p-4">{a.nodos?.nombre}</td>
                    <td className="p-4">{a.fecha_ingreso}</td>
                    <td className="p-4">{a.hora_ingreso}</td>

                    <td className="p-4 max-w-[220px] truncate">
                    {a.solicitante_nombre} {a.solicitante_ap_paterno} {a.solicitante_ap_materno}
                    </td>

                    <td className="p-4">{a.solicitante_num_doc}</td>
                    <td className="p-4">{a.solicitante_telefono}</td>
                    <td className="p-4">{a.empresas?.nombre}</td>
                    <td className="p-4">{a.areas_responsable?.nombre}</td>
                    <td className="p-4">{a.tipos_trabajo?.nombre}</td>
                    <td className="p-4 max-w-[250px] truncate">
                    {a.detalle_trabajo}
                    </td>

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

{a.sctr_path && (

  (Array.isArray(a.sctr_path) ? a.sctr_path : [a.sctr_path]).map((archivo, i) => {

    const { data } = supabase
      .storage
      .from("sctr")
      .getPublicUrl(archivo);

    return (
      <a
        key={i}
        href={data.publicUrl}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 text-xl mr-2 hover:text-blue-800 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        📄
      </a>
    );

  })

)}

</td>



<td className="p-4">
  <div className="inline-block max-w-[200px] w-fit p-3 bg-gray-50 rounded border text-sm space-y-1">
    {a.personal_acceso?.map((p, i) => (
      <div key={i} className="truncate">
        <span className="font-semibold">{i + 1})</span> {p.nombre} {p.ap_paterno} {p.ap_materno}
        <br />
        <span className="text-gray-500 text-xs">DNI: {p.num_doc}</span>
        <br />
        <span className="text-gray-500 text-xs">Telf: {p.telefono}</span>
      </div>
    ))}
  </div>
</td>

<td className="p-4">

  <div className="flex flex-col gap-2">

  <button
  disabled={acciones[a.id]}
  onClick={(e) => {
    e.stopPropagation();
    manejarAccion(a.id, "APROBADO", a.solicitante_correo);
  }}
  className={`px-3 py-1 rounded text-white transition-all
    ${acciones[a.id] === "APROBADO"
      ? "bg-green-800 scale-105 shadow-lg"
      : "bg-green-500 hover:bg-green-600"}
    ${acciones[a.id] && acciones[a.id] !== "APROBADO"
      ? "opacity-40"
      : ""}
  `}
>
  Aprobar
</button>

 <button
  disabled={acciones[a.id]}
  onClick={(e) => {
    e.stopPropagation();
    manejarAccion(a.id, "DENEGADO", a.solicitante_correo);
  }}
  className={`px-3 py-1 rounded text-white transition-all
    ${acciones[a.id] === "DENEGADO"
      ? "bg-red-800 scale-105 shadow-lg"
      : "bg-red-500 hover:bg-red-600"}
    ${acciones[a.id] && acciones[a.id] !== "DENEGADO"
      ? "opacity-40"
      : ""}
  `}
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

