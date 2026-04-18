import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { netboxGet } from "../Netbox";

function RacksView() {
  const [nodos, setNodos] = useState([]);
  const [nodoSeleccionado, setNodoSeleccionado] = useState("");
  const [racks, setRacks] = useState([]);
  const [rackSeleccionado, setRackSeleccionado] = useState("");
  const [rackImage, setRackImage] = useState("");

  // 🔹 cargar nodos desde tu BD
  useEffect(() => {
    const cargarNodos = async () => {
      const { data } = await supabase
        .from("nodos")
        .select("id, nombre, netbox_site_id");

      setNodos(data || []);
    };

    cargarNodos();
  }, []);

  // 🔹 cuando cambia nodo → traer racks desde NetBox
  useEffect(() => {
    if (!nodoSeleccionado) return;

    const cargarRacks = async () => {
      try {
        const nodo = nodos.find(n => n.id == nodoSeleccionado);
        if (!nodo?.netbox_site_id) return;

        const res = await netboxGet(`/dcim/racks/?site_id=${nodo.netbox_site_id}`);
        setRacks(res.results || []);
      } catch (err) {
        console.error("Error racks:", err);
      }
    };

    cargarRacks();
    setRackSeleccionado("");
    setRackImage("");
  }, [nodoSeleccionado]);

  // 🔹 cuando cambia rack → traer imagen SVG
  useEffect(() => {
    if (!rackSeleccionado) return;

    const cargarImagenRack = async () => {
      try {
        const res = await fetch(
          `http://172.16.29.91:8484/api/dcim/racks/${rackSeleccionado}/elevation/?face=front`,
          {
            headers: {
              Authorization: "Token bs49ckrnuP1pzzVekkpo16irphqLE1YiSDyZSQB"
            }
          }
        );

        const svg = await res.text();
        setRackImage(svg);
      } catch (err) {
        console.error("Error imagen rack:", err);
      }
    };

    cargarImagenRack();
  }, [rackSeleccionado]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* 🔹 SIDEBAR */}
      <div style={{
        width: "220px",
        background: "#f4f4f4",
        padding: "20px"
      }}>
        <h3 style={{ marginBottom: "20px" }}>WI-NET</h3>

        <p>Lista de Accesos</p>
        <p>Gestión Equipos</p>

        <p style={{
          background: "#2563eb",
          color: "white",
          padding: "8px",
          borderRadius: "6px"
        }}>
          Vista de Racks
        </p>
      </div>

      {/* 🔹 CONTENIDO */}
      <div style={{ flex: 1, padding: "40px" }}>

        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "30px",
          maxWidth: "800px",
          margin: "0 auto",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
        }}>

          <h2 style={{ textAlign: "center", marginBottom: "25px" }}>
            Vista de Rack
          </h2>

          {/* 🔹 FILTROS */}
          <div style={{
            display: "flex",
            gap: "20px",
            marginBottom: "20px"
          }}>

            {/* Nodo */}
            <div style={{ flex: 1 }}>
              <label>Nodo</label>
              <select
                value={nodoSeleccionado}
                onChange={(e) => setNodoSeleccionado(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Seleccione</option>
                {nodos.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Rack */}
            <div style={{ flex: 1 }}>
              <label>Rack</label>
              <select
                value={rackSeleccionado}
                onChange={(e) => setRackSeleccionado(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Seleccione</option>
                {racks.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* 🔹 VISOR RACK */}
          <div style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            height: "600px",
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "20px",
            background: "#f9f9f9"
          }}>

            {rackImage ? (
              <div
                style={{
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
                }}
                dangerouslySetInnerHTML={{ __html: rackImage }}
              />
            ) : (
              <p style={{ color: "#999" }}>
                Seleccione un rack
              </p>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

export default RacksView;