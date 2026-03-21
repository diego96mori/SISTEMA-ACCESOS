import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Equipos() {

  const navigate = useNavigate();

  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarMovimientos();
  }, []);

  const cargarMovimientos = async () => {

    const { data, error } = await supabase
      .from("movimientos")
      .select(`
        id,
        tipo_movimiento,
        created_at,

        accesos (
          id,
          fecha_ingreso,
          nodos ( nombre )
        ),

        equipo_retirado:equipo_retirado_id (
          id, marca, modelo, serie, rack_id, ru_inicio, cantidad_ru
        ),

        equipo_nuevo:equipo_nuevo_id (
          id, marca, modelo, serie, rack_id, ru_inicio, cantidad_ru
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      console.log(error.message);
    }

    setMovimientos(data || []);
    setLoading(false);
  };

  return (

    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white shadow-lg p-6">

        <h2 className="text-xl font-bold mb-6">WI-NET</h2>

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

      </aside>

      {/* MAIN */}
      <div className="flex-1 p-8">

        <h1 className="text-2xl font-semibold mb-6">
          Gestión de Equipos
        </h1>

        <div className="bg-white rounded-xl shadow overflow-x-auto">

          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (

            <table className="min-w-full text-sm">

              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">ID Solicitud</th>
                  <th className="p-4">Nodo</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Movimiento</th>
                  <th className="p-4">Equipo</th>
                  <th className="p-4">Rack</th>
                  <th className="p-4">RU</th>
                </tr>
              </thead>

              <tbody>

                {movimientos.map((m) => {

                  const equipo =
                    m.tipo_movimiento === "INSTALACION DE EQUIPOS"
                      ? m.equipo_nuevo
                      : m.tipo_movimiento === "RETIRO DE EQUIPOS"
                      ? m.equipo_retirado
                      : m.equipo_nuevo;

                  const ruFin = equipo?.ru_inicio
                    ? equipo.ru_inicio + equipo.cantidad_ru - 1
                    : null;

                  return (
                    <tr key={m.id} className="border-b">

                      <td className="p-4">{m.accesos?.id}</td>
                      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
                      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
                      <td className="p-4">{m.tipo_movimiento}</td>

                      <td className="p-4">
                        {m.tipo_movimiento === "REEMPLAZO DE EQUIPOS"
                          ? `RETIRA: ${m.equipo_retirado?.marca} → INSTALA: ${m.equipo_nuevo?.marca}`
                          : `${equipo?.marca || ""} ${equipo?.modelo || ""}`}
                      </td>

                      <td className="p-4">
                        {equipo?.rack_id ? `RACK ${equipo.rack_id}` : "-"}
                      </td>

                      <td className="p-4">
                        {equipo?.ru_inicio
                          ? `${equipo.ru_inicio}-${ruFin}`
                          : "-"}
                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          )}

        </div>

      </div>

    </div>

  );

}

export default Equipos;