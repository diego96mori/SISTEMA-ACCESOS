import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function RacksView() {

  const [nodos, setNodos] = useState([]);
  const [racks, setRacks] = useState([]);
  const [ruData, setRuData] = useState([]);

  const [nodoId, setNodoId] = useState("");
  const [rackId, setRackId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    cargarNodos();
  }, []);

  const cargarNodos = async () => {
    const { data } = await supabase.from("nodos").select("*");
    setNodos(data || []);
  };

  const cargarRacks = async (nodo) => {
    const { data } = await supabase
      .from("racks")
      .select("*")
      .eq("nodo_id", nodo);

    setRacks(data || []);
  };

  const cargarRU = async (rack) => {

    // 🔥 1. traer todas las RU
    const { data: ru } = await supabase
      .from("rack_ru")
      .select("*")
      .eq("rack_id", rack)
      .order("numero_ru", { ascending: false });

    // 🔥 2. traer equipos activos
    const { data: equipos } = await supabase
      .from("equipos")
      .select(`
        *,
        tipos_equipo ( nombre )
      `)
      .eq("rack_id", rack)
      .eq("estado", "ACTIVO");

    // 🔥 3. mapear RU con equipos
    const resultado = (ru || []).map(r => {

      let equipoEncontrado = null;

      for (let eq of (equipos || [])){
        const inicio = eq.ru_inicio;
        const fin = eq.ru_inicio + eq.cantidad_ru - 1;

        if (r.numero_ru >= inicio && r.numero_ru <= fin) {
          equipoEncontrado = eq;
          break;
        }
      }

      return {
        ...r,
        equipo: equipoEncontrado
      };
    });

    setRuData(resultado);
  };
return (

 
  
  <div className="min-h-screen bg-gray-100 flex">

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
    onClick={() => navigate("/equipos")}
    className="w-full text-left px-4 py-2 rounded-lg mt-2"
  >
    Gestión Equipos
  </button>

  <button
    className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2"
  >
    Vista de Racks
  </button>

</aside>

    {/* CONTENEDOR PRINCIPAL */}
    <div className="flex-1 p-8">
  <div className="bg-white rounded-2xl shadow-lg p-6 max-w-[700px]"></div>

      {/* 🔹 TÍTULO */}
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Vista de Rack
      </h2>

      {/* 🔹 FILTROS */}
      <div className="flex gap-4 mb-6">

        <div className="flex flex-col w-1/2">
          <label className="text-sm font-semibold mb-1">Nodo</label>
          <select
            value={nodoId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setNodoId(id);
              cargarRacks(id);
              setRackId("");
              setRuData([]);
            }}
            className="border p-2 rounded"
          >
            <option value="">Seleccione</option>
            {nodos.map(n => (
              <option key={n.id} value={n.id}>{n.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col w-1/2">
          <label className="text-sm font-semibold mb-1">Rack</label>
          <select
            value={rackId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setRackId(id);
              cargarRU(id);
            }}
            className="border p-2 rounded"
          >
            <option value="">Seleccione</option>
            {racks.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>

      </div>

      {/* 🔹 RACK VISUAL */}
      <div className="border rounded-lg overflow-hidden">

      {(() => {
  const bloques = [];
  let i = 0;

  while (i < ruData.length) {
    const actual = ruData[i];

    // 🔹 LIBRE
    if (!actual.equipo) {
      bloques.push(
        <div key={actual.id} className="flex border-b h-[28px]">
          <div className="w-12 bg-gray-800 text-white text-xs flex items-center justify-center">
            {actual.numero_ru}
          </div>
          <div className="flex-1 px-2 text-xs flex items-center bg-gray-100">
            LIBRE
          </div>
        </div>
      );
      i++;
      continue;
    }

    const eq = actual.equipo;
    const altura = eq.cantidad_ru * 28;

    bloques.push(
      <div key={eq.id} className="flex border-b">

        {/* NUMEROS (SIEMPRE SEPARADOS) */}
        <div className="flex flex-col">
          {Array.from({ length: eq.cantidad_ru }).map((_, j) => (
            <div
              key={j}
              className="w-12 h-[28px] bg-gray-800 text-white text-xs flex items-center justify-center"
            >
              {eq.ru_inicio + eq.cantidad_ru - 1 - j}
            </div>
          ))}
        </div>

        {/* BLOQUE VERDE UNIFICADO */}
        <div
          className="flex-1 bg-green-300 flex items-center justify-center text-xs"
          style={{ height: `${altura}px` }}
        >
          <div className="text-center">
            <div className="font-semibold">
              {eq.tipos_equipo?.nombre}
            </div>
            <div>{eq.modelo}</div>
          </div>
        </div>

      </div>
    );

    i += eq.cantidad_ru;
  }

  return bloques;
})()}

      </div>

    </div>

  </div>
);
}

export default RacksView;