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

  ru_inicio,
  cantidad_ru,
  cantidad_hilos,
  estado,
  movimiento_id,

   racks ( nombre ),

  tipos_equipo (
    nombre
  )
),

    reemplazos (
     equipo_retirado:equipo_retirado_id (
  marca,
  modelo,
  serie,
  tipos_equipo ( nombre )
),
equipo_nuevo:equipo_nuevo_id (
  marca,
  modelo,
  serie,
  tipos_equipo ( nombre )
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


{/* 🔥 NUEVO BOTÓN AQUÍ */}
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
            <p className="p-6">Cargando...</p>
          ) : (

            <table className="min-w-full text-sm">

              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4 w-[80px]">ID Solicitud</th>
                  <th className="p-4 w-[150px]">Nodo</th>
                  <th className="p-4 w-[120px]">Fecha</th>
                  <th className="p-4 w-[180px]">Movimiento</th>
                 <th className="p-4 w-[200px]">Equipo</th>
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
  <div className="bg-gray-50 border rounded-lg p-2 text-xs inline-block">

   
      <div className="text-green-600 font-semibold mb-1">
        INSTALACION
      </div>
  

    <div><b>EQUIPO:</b> {equipo.tipos_equipo?.nombre || "-"}</div>
    <div><b>MARCA:</b> {equipo.marca || "-"}</div>
    <div><b>MODELO:</b> {equipo.modelo || "-"}</div>

    {equipo.serie && (
      <div><b>SERIE:</b> {equipo.serie}</div>
    )}

  </div>
</td>

       <td className="p-4">
 {equipo?.racks?.nombre || "-"}
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

const equipoRetirado = movimientos
  .flatMap(x => x.equipos || [])
  .find(e => 
    e.estado === "RETIRADO" &&
    e.movimiento_id !== m.id
  );

  if (!equipoRetirado) return [];

  const ruFin = equipoRetirado.ru_inicio + equipoRetirado.cantidad_ru - 1;

  return [
    <tr key={m.id} className="border-b">

      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-red-600">{m.tipo_movimiento}</td>

      <td className="p-4">
        <div className="bg-gray-50 border rounded-lg p-2 text-xs">
          <div className="text-red-600 font-semibold mb-1">RETIRO</div>

          <div><b>EQUIPO:</b> {equipoRetirado.tipos_equipo?.nombre}</div>
          <div><b>MARCA:</b> {equipoRetirado.marca}</div>
          <div><b>MODELO:</b> {equipoRetirado.modelo}</div>
          <div><b>SERIE:</b> {equipoRetirado.serie}</div>
        </div>
      </td>

      <td className="p-4">{equipoRetirado?.racks?.nombre}</td>

      <td className="p-4">
        {equipoRetirado.ru_inicio}-{ruFin}
      </td>

    </tr>
  ];
}

    
   // 🟣 REEMPLAZO
   
if (m.tipo_movimiento === "REEMPLAZO DE EQUIPOS") {

  const reemplazo = m.reemplazos?.[0];

  if (!reemplazo) return [];

  const equipoRetirado = reemplazo.equipo_retirado;
  const equipoNuevo = reemplazo.equipo_nuevo;

  const equipoReal = m.equipos?.find(e => e.movimiento_id === m.id);

  const ruFin = equipoReal?.ru_inicio
    ? equipoReal.ru_inicio + equipoReal.cantidad_ru - 1
    : null;

  // 🔴 RETIRO (USA equipo_retirado)
  const filaRetiro = (
    <tr key={`${m.id}-retira`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-purple-600">REEMPLAZO DE EQUIPOS</td>

      <td className="p-4">
        <div className="bg-purple-50 border rounded-lg p-2 text-xs inline-block w-fit">
          <div className="text-red-600 font-semibold mb-1">
            RETIRO
          </div>

          <div><b>EQUIPO:</b> {equipoRetirado?.tipos_equipo?.nombre || "-"}</div>
          <div><b>MARCA:</b> {equipoRetirado?.marca || "-"}</div>
          <div><b>MODELO:</b> {equipoRetirado?.modelo || "-"}</div>
          <div><b>SERIE:</b> {equipoRetirado?.serie || "-"}</div>
        </div>
      </td>

      <td className="p-4">
        {equipoReal?.racks?.nombre || "-"}
      </td>

      <td className="p-4">
        {equipoReal?.ru_inicio ? `${equipoReal.ru_inicio}-${ruFin}` : "-"}
      </td>
    </tr>
  );

  // 🟢 INSTALACION (USA equipo_nuevo)
  const filaInstalacion = (
    <tr key={`${m.id}-instala`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-purple-600">REEMPLAZO DE EQUIPOS</td>

      <td className="p-4">
        <div className="bg-purple-50 border rounded-lg p-2 text-xs inline-block w-fit">
          <div className="text-green-600 font-semibold mb-1">
            INSTALACION
          </div>

          <div><b>EQUIPO:</b> {equipoNuevo?.tipos_equipo?.nombre || "-"}</div>
          <div><b>MARCA:</b> {equipoNuevo?.marca || "-"}</div>
          <div><b>MODELO:</b> {equipoNuevo?.modelo || "-"}</div>
          <div><b>SERIE:</b> {equipoNuevo?.serie || "-"}</div>
        </div>
      </td>

      <td className="p-4">
        {equipoReal?.racks?.nombre || "-"}
      </td>

      <td className="p-4">
        {equipoReal?.ru_inicio ? `${equipoReal.ru_inicio}-${ruFin}` : "-"}
      </td>
    </tr>
  );

  return [filaRetiro, filaInstalacion];
}
  // 🔵 FILA FIBRA ......................

if (m.tipo_movimiento === "INGRESO_FO") {

  let filas = [];
  const fibra = m.equipos?.find(e => e.cantidad_hilos);

  // 🔵 FILA FIBRA
  filas.push(
    <tr key={`${m.id}-fibra`} className="border-b">
      <td className="p-4">{m.accesos?.id}</td>
      <td className="p-4">{m.accesos?.nodos?.nombre}</td>
      <td className="p-4">{m.accesos?.fecha_ingreso}</td>
      <td className="p-4 text-blue-600">INGRESO FO</td>

      <td className="p-4">
        <div className="bg-blue-50 border rounded-lg p-2 text-xs">
          
          <div><b>FIBRA:</b> {fibra?.cantidad_hilos || "?"} hilos</div>
        </div>
      </td>


      <td className="p-4">-</td>
      <td className="p-4">-</td>
    </tr>
  );

  // 🟢 PATCHPANEL (si existen equipos)
  (m.equipos || [])
  .filter(eq =>
    eq.movimiento_id === m.id &&
    eq.tipos_equipo?.nombre === "PATCH PANEL"
  )
  .forEach((equipo, i) => {

    const ruFin = equipo.ru_inicio + equipo.cantidad_ru - 1;

    filas.push(
      <tr key={`${m.id}-pp-${i}`} className="border-b">

        <td className="p-4">{m.accesos?.id}</td>
        <td className="p-4">{m.accesos?.nodos?.nombre}</td>
        <td className="p-4">{m.accesos?.fecha_ingreso}</td>
        <td className="p-4 text-blue-600">INGRESO FO</td>

        <td className="p-4">
          <div className="bg-blue-50 border rounded-lg p-2 text-xs inline-block max-w-[160px]">

         
            <div><b>EQUIPO:</b> PATCH PANEL</div>

          </div>
        </td>

    <td className="p-4">
 {equipo?.racks?.nombre || "-"}
</td>
        <td className="p-4">
          {equipo.ru_inicio ? `${equipo.ru_inicio}-${ruFin}` : "-"}
        </td>

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