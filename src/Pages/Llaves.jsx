import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Llaves.css";

function Llaves() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [nodo, setNodo] = useState("");
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [nodoId, setNodoId] = useState(null);
  const [tipoTrabajoId, setTipoTrabajoId] = useState(null);
  const [cantidadLlaves, setCantidadLlaves] = useState(1);
  const [llaves, setLlaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    validarAcceso();
  }, []);

  const validarAcceso = async () => {
    const { data } = await supabase
      .rpc("validar_acceso_llaves", { p_id: Number(id) });

    if (data !== "AUTORIZADO") {
      navigate("/");
      return;
    }

    const { data: accesoData } = await supabase
      .from("accesos")
      .select(`
        nodo_id,
        tipo_trabajo_id,
        nodos ( nombre ),
        tipos_trabajo ( nombre )
      `)
      .eq("id", id)
      .single();

    setNodo(accesoData.nodos.nombre);
    setTipoTrabajo(accesoData.tipos_trabajo.nombre);
    setNodoId(accesoData.nodo_id);
    setTipoTrabajoId(accesoData.tipo_trabajo_id);

    setLoading(false);
  };

  const actualizarLlave = (index, campo, valor) => {
    const nuevas = [...llaves];
    if (!nuevas[index]) nuevas[index] = {};
    nuevas[index][campo] = valor;
    setLlaves(nuevas);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;
    setSaving(true);

    try {

      const payload = {
        acceso_id: Number(id),
        tipo_trabajo_id: tipoTrabajoId,
        llaves: llaves
      };

      const { error } = await supabase
        .rpc("procesar_llaves", {
          p_data: payload
        });

      if (error) throw error;

      alert("Registro de llaves guardado correctamente");
      navigate("/");

    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <h3>Validando acceso...</h3>;
  }

  return (
    <>
      <div className="home-container">
        <div className="home-card">

          <h2 style={{ marginBottom: "10px" }}>
            Gestión de Llaves
          </h2>

          <p style={{ marginBottom: "25px", opacity: 0.6 }}>
            ID de Acceso: <strong>{id}</strong>
          </p>

          <form onSubmit={handleSubmit}>

            <div className="form-row">
              <label>Nodo</label>
              <input value={nodo} className="form-control" disabled />
            </div>

            <div className="form-row">
              <label>Tipo de trabajo</label>
              <input value={tipoTrabajo} className="form-control" disabled />
            </div>

            <div className="form-row">
              <label>N° de llaves</label>
              <select
                className="form-control"
                value={cantidadLlaves}
                onChange={(e) =>
                  setCantidadLlaves(Number(e.target.value))
                }
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {Array.from({ length: cantidadLlaves }).map((_, i) => (
              <div key={i} className="equipo-box">

                <h5 style={{ color: "#007bff", marginBottom: "15px" }}>
                  🔑 Llave {i + 1}
                </h5>

                <div className="form-row">
                  <label>Código de llave</label>
                  <input
                    className="form-control"
                    onChange={(e) =>
                      actualizarLlave(i, "codigo", e.target.value)
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Observación</label>
                  <input
                    className="form-control"
                    onChange={(e) =>
                      actualizarLlave(i, "observacion", e.target.value)
                    }
                  />
                </div>

              </div>
            ))}

            <button
              type="submit"
              className="btn btn-warning"
              style={{ marginTop: "15px" }}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>

          </form>

        </div>
      </div>
    </>
  );
}

export default Llaves;
