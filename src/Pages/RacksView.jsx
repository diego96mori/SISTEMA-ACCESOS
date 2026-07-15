import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  consultarElevacionRackAdmin,
  consultarRacksAdmin,
} from "../services/equipos";

function RacksView() {
  const navigate = useNavigate();
  const [nodos, setNodos] = useState([]);
  const [nodoSeleccionado, setNodoSeleccionado] = useState("");
  const [racks, setRacks] = useState([]);
  const [rackSeleccionado, setRackSeleccionado] = useState("");
  const [rackData, setRackData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const cargarNodos = async () => {
      const { data, error: queryError } = await supabase
        .from("nodos")
        .select("id, nombre, netbox_site_id")
        .order("nombre");
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setNodos(data || []);
    };
    cargarNodos();
    return () => {
      active = false;
    };
  }, []);

  const seleccionarNodo = async (value) => {
    const nodeId = Number(value) || "";
    setNodoSeleccionado(nodeId);
    setRackSeleccionado("");
    setRackData([]);
    setRacks([]);
    setError("");
    if (!nodeId) return;

    try {
      setLoading(true);
      setRacks(await consultarRacksAdmin(nodeId));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  const seleccionarRack = async (value) => {
    const rackId = Number(value) || "";
    setRackSeleccionado(rackId);
    setRackData([]);
    setError("");
    if (!rackId || !nodoSeleccionado) return;

    try {
      setLoading(true);
      setRackData(await consultarElevacionRackAdmin(nodoSeleccionado, rackId));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">WI-NET</h2>
        <button onClick={() => navigate("/dashboard")} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200">
          Lista de Accesos
        </button>
        <button onClick={() => navigate("/equipos")} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2">
          Gestion Equipos
        </button>
        <button className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2">
          Vista de Racks
        </button>
      </aside>

      <main className="flex-1 p-8">
        <div className="bg-white rounded-xl shadow p-6 max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-center mb-6">Vista de Rack</h1>
          {error && <div className="p-3 mb-4 bg-red-100 text-red-800 rounded">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label>
              Nodo
              <select className="border rounded p-2 w-full" value={nodoSeleccionado} onChange={(event) => seleccionarNodo(event.target.value)}>
                <option value="">Seleccione</option>
                {nodos.map((node) => <option key={node.id} value={node.id}>{node.nombre}</option>)}
              </select>
            </label>
            <label>
              Rack
              <select className="border rounded p-2 w-full" value={rackSeleccionado} disabled={!nodoSeleccionado || loading} onChange={(event) => seleccionarRack(event.target.value)}>
                <option value="">Seleccione</option>
                {racks.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
              </select>
            </label>
          </div>

          <div className="border rounded-xl min-h-[600px] overflow-auto p-5 bg-gray-900 flex justify-center">
            {loading ? <p className="text-gray-300">Consultando NetBox...</p> : rackData.length > 0 ? (
              <div className="w-72">
                {[...rackData].sort((a, b) => Number(b.id) - Number(a.id)).map((unit) => {
                  const occupied = Boolean(unit.occupied || unit.device);
                  return (
                    <div key={unit.id} className={`h-7 border border-gray-600 text-white text-xs flex items-center justify-center ${occupied ? "bg-purple-700" : "bg-gray-800"}`}>
                      U{unit.id} {occupied ? `- ${unit.device?.name || "OCUPADO"}` : "- LIBRE"}
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-gray-400">Seleccione un rack</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default RacksView;
