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

    accesos!inner (
      id,
      fecha_ingreso,
      nodos ( nombre )
    ),

    equipos (
      id,
      marca,
      modelo,
      serie,
      rack_id,
      ru_inicio,
      cantidad_ru,
      estado,
      movimiento_id
    ),

    reemplazos (
      equipo_retirado:equipo_retirado_id (
        marca, modelo, serie
      ),
      equipo_nuevo:equipo_nuevo_id (
        marca, modelo, serie
      )
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

            <table className="min-w-full text-sm table-fixed">

              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4 w-[80px]">ID Solicitud</th>
                  <th className="p-4 w-[150px]">Nodo</th>
                  <th className="p-4 w-[120px]">Fecha</th>
                  <th className="p-4 w-[180px]">Movimiento</th>
                  <th className="p-4 w-[250px]">Equipo</th>
                 <th className="p-4 w-[120px]">Rack</th>
                  <th className="p-4 w-[100px]">RU</th>
                </tr>
              </thead>

       <tbody>
  {movimientos.flatMap((m) => {

    let reemplazo = m.reemplazos?.[0];

    
   // 🔵 INSTALACION
if (m.tipo_movimiento === "INSTALACION DE EQUIPOS") {
  return (m.equipos || [])
    .filter(eq => eq.estado === "ACTIVO")
    .map((equipo, i) => {

      const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

      return (
        <tr key={`${m.id}-${i}`} className="border-b">

          <td className="p-4">{m.accesos?.id}</td>
          <td className="p-4">{m.accesos?.nodos?.nombre}</td>
          <td className="p-4">{m.accesos?.fecha_ingreso}</td>
          <td className="p-4 text-green-600">{m.tipo_movimiento}</td>

          <td className="p-4">
            {equipo.marca} {equipo.modelo}
          </td>

          <td className="p-4">
            Rack {equipo.rack_id}
          </td>

          <td className="p-4">
            {equipo.ru_inicio}-{ruFin}
          </td>

        </tr>
      );
    });
}


// 🔴 RETIRO
if (m.tipo_movimiento === "RETIRO DE EQUIPOS") {
  return (m.equipos || [])
    .filter(eq => eq.estado === "RETIRADO")
    .map((equipo, i) => {

      const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

      return (
        <tr key={`${m.id}-${i}`} className="border-b">

          <td className="p-4">{m.accesos?.id}</td>
          <td className="p-4">{m.accesos?.nodos?.nombre}</td>
          <td className="p-4">{m.accesos?.fecha_ingreso}</td>
          <td className="p-4 text-red-600">{m.tipo_movimiento}</td>

          <td className="p-4">
            {equipo.marca} {equipo.modelo}
          </td>

          <td className="p-4">
            Rack {equipo.rack_id}
          </td>

          <td className="p-4">
            {equipo.ru_inicio}-{ruFin}
          </td>

        </tr>
      );
    });
}

    // 🟣 REEMPLAZO
    return [
      <tr key={m.id} className="border-b">

        <td className="p-4">{m.accesos?.id}</td>
        <td className="p-4">{m.accesos?.nodos?.nombre}</td>
        <td className="p-4">{m.accesos?.fecha_ingreso}</td>
        <td className="p-4">{m.tipo_movimiento}</td>

      <td className="p-4 max-w-[250px]">
  <div className="text-red-600 text-xs truncate">
    RETIRA: {reemplazo?.equipo_retirado?.marca}
  </div>
  <div className="text-green-600 text-xs truncate">
    INSTALA: {reemplazo?.equipo_nuevo?.marca}
  </div>
</td>
        <td className="p-4">-</td>
        <td className="p-4">-</td>

      </tr>
    ];

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