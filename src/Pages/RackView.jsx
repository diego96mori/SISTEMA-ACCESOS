import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function RacksView() {

  const [nodos, setNodos] = useState([]);
  const [racks, setRacks] = useState([]);
  const [ruData, setRuData] = useState([]);

  const [nodoId, setNodoId] = useState("");
  const [rackId, setRackId] = useState("");

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
    const resultado = ru.map(r => {

      let equipoEncontrado = null;

      for (let eq of equipos) {
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
    <div className="p-6">

      <h2 className="text-xl font-bold mb-4">Vista de Racks</h2>

      {/* FILTROS */}
      <div className="flex gap-4 mb-6">

        <select
          value={nodoId}
          onChange={(e) => {
            setNodoId(e.target.value);
            cargarRacks(e.target.value);
            setRackId("");
            setRuData([]);
          }}
          className="border p-2 rounded"
        >
          <option value="">Seleccione Nodo</option>
          {nodos.map(n => (
            <option key={n.id} value={n.id}>{n.nombre}</option>
          ))}
        </select>

        <select
          value={rackId}
          onChange={(e) => {
            setRackId(e.target.value);
            cargarRU(e.target.value);
          }}
          className="border p-2 rounded"
        >
          <option value="">Seleccione Rack</option>
          {racks.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>

      </div>

      {/* VISTA RACK */}
      <div className="border rounded overflow-hidden">

        {ruData.map(ru => (
          <div
            key={ru.id}
            className={`flex border-b ${
              ru.estado === "OCUPADO"
                ? "bg-green-200"
                : "bg-gray-100"
            }`}
          >

            {/* NUMERO RU */}
            <div className="w-16 bg-gray-800 text-white text-center p-2">
              {ru.numero_ru}
            </div>

            {/* INFO */}
            <div className="flex-1 p-2">

              {ru.equipo ? (
                <>
                  <div className="font-semibold">
                    {ru.equipo.tipos_equipo?.nombre}
                  </div>
                  <div>{ru.equipo.marca}</div>
                  <div>{ru.equipo.modelo}</div>
                  <div className="text-xs text-gray-600">
                    {ru.equipo.serie}
                  </div>
                </>
              ) : (
                <span className="text-gray-500">LIBRE</span>
              )}

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}

export default RacksView;