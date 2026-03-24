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
    cantidad_hilos,

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
  movimiento_id,

  tipos_equipo (
    nombre
  )
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
.filter(eq => eq.movimiento_id === m.id)
.map((equipo, i) => {

      const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

      return (
        <tr key={`${m.id}-${i}`} className="border-b">

          <td className="p-4">{m.accesos?.id}</td>
          <td className="p-4">{m.accesos?.nodos?.nombre}</td>
          <td className="p-4">{m.accesos?.fecha_ingreso}</td>
          <td className="p-4 text-green-600">{m.tipo_movimiento}</td>

         <td className="p-4">
  <div className="bg-gray-50 border rounded-lg p-2 text-xs">
    <div><b>EQUIPO:</b> {equipo.tipos_equipo?.nombre || "-"}</div>
    <div><b>MARCA:</b> {equipo.marca}</div>
    <div><b>MODELO:</b> {equipo.modelo}</div>
  </div>
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
.filter(eq => eq.movimiento_id === m.id)
.map((equipo, i) => {

      const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

      return (
        <tr key={`${m.id}-${i}`} className="border-b">

          <td className="p-4">{m.accesos?.id}</td>
          <td className="p-4">{m.accesos?.nodos?.nombre}</td>
          <td className="p-4">{m.accesos?.fecha_ingreso}</td>
          <td className="p-4 text-red-600">{m.tipo_movimiento}</td>

        <td className="p-4">
  <div className="bg-gray-50 border rounded-lg p-2 text-xs">
    <div><b>EQUIPO:</b> {equipo.tipos_equipo?.nombre || "-"}</div>
    <div><b>MARCA:</b> {equipo.marca}</div>
    <div><b>MODELO:</b> {equipo.modelo}</div>
  </div>
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
    // 🟣 REEMPLAZO
if (m.tipo_movimiento === "REEMPLAZO DE EQUIPOS") {

  return [

    // 🔴 FILA RETIRO
    <tr key={`${m.id}-retira`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-red-600">RETIRO</td>

      <td className="p-4">
        <div className="bg-red-50 border rounded-lg p-2 text-xs">
          <div><b>EQUIPO:</b> {reemplazo?.equipo_retirado?.modelo}</div>
<div><b>MARCA:</b> {reemplazo?.equipo_retirado?.marca}</div>
<div><b>SERIE:</b> {reemplazo?.equipo_retirado?.serie}</div>
        </div>
      </td>

      <td className="p-4">-</td>
      <td className="p-4">-</td>
    </tr>,

    // 🟢 FILA INSTALACION
    <tr key={`${m.id}-instala`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-green-600">INSTALACION</td>

      <td className="p-4">
        <div className="bg-green-50 border rounded-lg p-2 text-xs">
  <div><b>EQUIPO:</b> {reemplazo?.equipo_nuevo?.modelo}</div>
<div><b>MARCA:</b> {reemplazo?.equipo_nuevo?.marca}</div>
<div><b>SERIE:</b> {reemplazo?.equipo_nuevo?.serie}</div>
        </div>
      </td>

      <td className="p-4">-</td>
      <td className="p-4">-</td>
    </tr>

  ];
}


if (m.tipo_movimiento === "INGRESO_FO") {

  let filas = [];

  // 🔵 FILA FIBRA
  filas.push(
    <tr key={`${m.id}-fibra`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-blue-600">INGRESO FO</td>

      <td className="p-4">
        <div className="bg-blue-50 border rounded-lg p-2 text-xs">
          <div><b>FIBRA:</b> {m.cantidad_hilos || "?"} hilos</div>
        </div>
      </td>

      <td className="p-4">-</td>
      <td className="p-4">-</td>
    </tr>
  );

  // 🟢 PATCHPANEL (si existen equipos)
  (m.equipos || [])
  .filter(eq => eq.movimiento_id === m.id)
  .forEach((equipo, i) => {

    const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

    filas.push(
      <tr key={`${m.id}-pp-${i}`} className="border-b">

        <td className="p-4">{m.accesos?.id}</td>
        <td className="p-4">{m.accesos?.nodos?.nombre}</td>
        <td className="p-4">{m.accesos?.fecha_ingreso}</td>
        <td className="p-4 text-green-600">PATCHPANEL</td>

        <td className="p-4">
          <div className="bg-green-50 border rounded-lg p-2 text-xs">
            <div><b>EQUIPO:</b> {equipo.marca}</div>
          </div>
        </td>

        <td className="p-4">Rack {equipo.rack_id}</td>
        <td className="p-4">{equipo.ru_inicio}-{ruFin}</td>

      </tr>
    );
  });

  return filas;
}

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