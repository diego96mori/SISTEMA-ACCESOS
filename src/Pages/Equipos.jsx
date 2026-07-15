import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  netboxDelete
} from "../Netbox";

function Equipos() {

  const navigate = useNavigate();

  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarMovimientos();
  }, []);

  /* ===================================== */
  /* CARGAR MOVIMIENTOS */
  /* ===================================== */

  const cargarMovimientos = async () => {

    const { data, error } = await supabase
      .from("movimientos")
      .select(`
        id,
        acceso_id,
        tipo_movimiento,
        estado,
        aprobado_por,
        fecha_aprobacion,
        created_at,

        accesos (
          id,
          fecha_ingreso,
          nodos (
            nombre
          )
        ),

        movimiento_detalle (
          id,
          accion,
          rack_name,
          rack_netbox_id,
          equipo_name,
          equipo_netbox_id,
          ru_inicio,
          ru_fin
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
    }

    setMovimientos(data || []);

    setLoading(false);
  };

  /* ===================================== */
  /* APROBAR */
  /* ===================================== */
const aprobarMovimiento = async (movimientoId) => {

  try {

    const {
      data: { user }
    } = await supabase.auth.getUser();

    /* ===================================== */
    /* DETALLE */
    /* ===================================== */

    const {
      data: detalles,
      error: detalleError
    } = await supabase
      .from("movimiento_detalle")
      .select("*")
      .eq("movimiento_id", movimientoId);

    if (detalleError) {

      console.log(detalleError);

      alert(
        "Error obteniendo detalle"
      );

      return;
    }

    /* ===================================== */
    /* RECORRER */
    /* ===================================== */

    for (const item of detalles) {

      /* ===================================== */
      /* RETIRO */
      /* ===================================== */

      if (item.accion === "RETIRO") {

        await netboxDelete(

  `/dcim/devices/${item.equipo_netbox_id}/`
);
      }
    }

    /* ===================================== */
    /* APROBAR */
    /* ===================================== */

    const { error } = await supabase
      .from("movimientos")
      .update({

        estado: "APROBADO",

        aprobado_por:
          user.email,

        fecha_aprobacion:
          new Date()
      })
      .eq("id", movimientoId);

    if (error) {

      console.log(error);

      alert("Error aprobando");

      return;
    }

    alert(
      "Solicitud aprobada y sincronizada con NetBox"
    );

    cargarMovimientos();

  } catch (err) {

    console.log(err);

    alert(
      "Error sincronizando NetBox"
    );
  }
};

  /* ===================================== */
  /* DENEGAR */
  /* ===================================== */

  const denegarMovimiento = async (movimientoId) => {

    try {

      const {
        data: { user }
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("movimientos")
        .update({
          estado: "DENEGADO",
          aprobado_por: user.email,
          fecha_aprobacion: new Date()
        })
        .eq("id", movimientoId);

      if (error) {
        console.log(error);
        alert("Error denegando");
        return;
      }

      alert("Solicitud denegada");

      cargarMovimientos();

    } catch (err) {

      console.log(err);

      alert("Error general");
    }
  };

  return (

    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white shadow-lg p-6">

        <h2 className="text-xl font-bold mb-6">
          WI-NET
        </h2>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200"
        >
          Lista de Accesos
        </button>

        <button
          className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2"
        >
          Gestión Equipos
        </button>

        <button
          onClick={() => navigate("/racks")}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2"
        >
          Vista de Racks
        </button>

      </aside>

      {/* MAIN */}
      <div className="flex-1 p-8">

        <h1 className="text-2xl font-semibold mb-6">
          Gestión de Equipos
        </h1>

        <div className="bg-white rounded-xl shadow overflow-x-auto">

          {loading ? (

            <p className="p-6">
              Cargando...
            </p>

          ) : (

            <table className="min-w-full text-sm">

              <thead className="bg-gray-100 text-xs uppercase">

                <tr>

                  <th className="p-4">
                    ID
                  </th>

                  <th className="p-4">
                    Nodo
                  </th>

                  <th className="p-4">
                    Fecha
                  </th>

                  <th className="p-4">
                    Tipo
                  </th>

                  <th className="p-4">
                    Rack
                  </th>

                  <th className="p-4">
                    Equipo
                  </th>

                  <th className="p-4">
                    RU
                  </th>

                  <th className="p-4">
                    Estado
                  </th>

                  <th className="p-4">
                    Aprobación
                  </th>

                </tr>

              </thead>

              <tbody>

                {movimientos.flatMap((m) =>

                  (m.movimiento_detalle || []).map((d, i) => (

                    <tr
                      key={`${m.id}-${i}`}
                      className="border-b"
                    >

                      {/* ID */}
                      <td className="p-4">
                        {m.accesos?.id}
                      </td>

                      {/* NODO */}
                      <td className="p-4">
                        {m.accesos?.nodos?.nombre}
                      </td>

                      {/* FECHA */}
                      <td className="p-4">
                        {m.accesos?.fecha_ingreso}
                      </td>

                      {/* MOVIMIENTO */}
                      <td className="p-4">

                        <div className="font-semibold text-red-600">
                          {m.tipo_movimiento}
                        </div>
              
                      </td>

                      {/* RACK */}
                      <td className="p-4">
                        {d.rack_name || "-"}
                      </td>

                      {/* EQUIPO */}
                      <td className="p-4">

                        <div className="bg-gray-50 border rounded-lg p-2 text-xs inline-block">

                          <div>
                            <b>EQUIPO:</b>
                            {" "}
                            {d.equipo_name}
                          </div>

                          <div>
                            <b>NETBOX ID:</b>
                            {" "}
                            {d.equipo_netbox_id}
                          </div>

                        </div>

                      </td>

                      {/* RU */}
                      <td className="p-4">

                        {d.ru_inicio && d.ru_fin
                        ? `${d.ru_inicio} - ${d.ru_fin}`
                        : "-"}


                      </td>

                      {/* ESTADO */}
                      <td className="p-4">

                        {m.estado === "PENDIENTE" && (
                          <span className="text-yellow-600 font-semibold">
                            PENDIENTE
                          </span>
                        )}

                        {m.estado === "APROBADO" && (
                          <span className="text-green-600 font-semibold">
                            APROBADO
                          </span>
                        )}

                        {m.estado === "DENEGADO" && (
                          <span className="text-red-600 font-semibold">
                            DENEGADO
                          </span>
                        )}

                        {m.aprobado_por && (
                          <div className="text-xs text-gray-500 mt-1">
                            {m.aprobado_por}
                          </div>
                        )}

                      </td>

                      {/* BOTONES */}
                      <td className="p-4">

                        {m.estado === "PENDIENTE" ? (

                          <div className="flex gap-2">

                            <button
                              className="bg-green-600 text-white px-3 py-1 rounded"
                              onClick={() =>
                                aprobarMovimiento(m.id)
                              }
                            >
                              PROCEDER
                            </button>

                            <button
                              className="bg-red-600 text-white px-3 py-1 rounded"
                              onClick={() =>
                                denegarMovimiento(m.id)
                              }
                            >
                              DENEGAR
                            </button>

                          </div>

                        ) : (

                          <span className="text-gray-500 text-xs">
                            Solicitud finalizada
                          </span>

                        )}

                      </td>

                    </tr>
                  ))
                )}

              </tbody>

            </table>
          )}

        </div>

      </div>

    </div>
  );
}

export default Equipos;
