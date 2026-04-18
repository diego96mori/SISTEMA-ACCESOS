import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { netboxGet } from "../api/netbox";
import "./Instalaciones.css";

function Instalaciones() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [nodo, setNodo] = useState("");
  const [siteId, setSiteId] = useState(null);
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [racks, setRacks] = useState([]);

  const [cantidadEquipos, setCantidadEquipos] = useState(1);
  const [equiposRetiro, setEquiposRetiro] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (siteId) {
      cargarRacks();
    }
  }, [siteId]);

  /* ============================= */
  /* VALIDAR ACCESO */
  /* ============================= */

  const validarAcceso = async () => {

    const { data } = await supabase
      .rpc("validar_acceso_instalaciones", { p_id: Number(id) });

    if (data !== "AUTORIZADO") {
      navigate("/");
      return;
    }

    const { data: accesoData } = await supabase
      .from("accesos")
      .select(`
        nodo_id,
        tipo_trabajo_id,
        nodos ( nombre, netbox_site_id ),
        tipos_trabajo ( nombre )
      `)
      .eq("id", id)
      .single();

    setNodo(accesoData.nodos.nombre);
    setSiteId(accesoData.nodos.netbox_site_id);
    setTipoTrabajo(accesoData.tipos_trabajo.nombre);

    setLoading(false);
  };

  /* ============================= */
  /* NETBOX */
  /* ============================= */

  const cargarRacks = async () => {
    const data = await netboxGet(`/dcim/racks/?site_id=${siteId}`);
    setRacks(data.results);
  };

  const cargarEquiposPorRack = async (rackId) => {
    const data = await netboxGet(`/dcim/devices/?rack_id=${rackId}`);
    return data.results;
  };

  /* ============================= */
  /* ACTUALIZAR */
  /* ============================= */

  const actualizarRetiro = (index, campo, valor) => {
    const nuevos = [...equiposRetiro];
    if (!nuevos[index]) nuevos[index] = {};
    nuevos[index][campo] = valor;
    setEquiposRetiro(nuevos);
  };

  if (loading) {
    return <h3>Validando acceso...</h3>;
  }

  /* ============================= */
  /* UI */
  /* ============================= */

  return (
    <div className="home-container">
      <div className="home-card">

        <h2>Gestion de Equipos</h2>

        <p>ID de Acceso: <strong>{id}</strong></p>

        {/* NODO */}
        <div className="form-row">
          <label>Nodo</label>
          <input value={nodo} className="form-control" disabled />
        </div>

        {/* TIPO */}
        <div className="form-row">
          <label>Tipo de trabajo</label>
          <input value={tipoTrabajo} className="form-control" disabled />
        </div>

        {/* CANTIDAD */}
        <div className="form-row">
          <label>N° de equipos</label>
          <select
            className="form-control"
            value={cantidadEquipos}
            onChange={(e) => setCantidadEquipos(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* DINÁMICO */}
        {Array.from({ length: cantidadEquipos }).map((_, i) => (

          <div key={i} className="equipo-box">

            <h5 style={{ color: "red" }}>
              🔴 Equipo a Retirar {i + 1}
            </h5>

            {/* RACK */}
            <div className="form-row">
              <label>Rack</label>
              <select
                className="form-control"
                value={equiposRetiro[i]?.rackId || ""}
                onChange={async (e) => {

                  const rackId = Number(e.target.value);

                  actualizarRetiro(i, "rackId", rackId);
                  actualizarRetiro(i, "equipoId", null);

                  const equipos = await cargarEquiposPorRack(rackId);

                  const nuevos = [...equiposRetiro];
                  nuevos[i] = {
                    ...nuevos[i],
                    listaEquipos: equipos
                  };

                  setEquiposRetiro(nuevos);
                }}
              >
                <option value="">Seleccione Rack</option>
                {racks.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* EQUIPO */}
            {equiposRetiro[i]?.rackId && (
              <div className="form-row">
                <label>Equipo</label>
                <select
                  className="form-control"
                  value={equiposRetiro[i]?.equipoId || ""}
                  onChange={(e) => {

                    const equipo = equiposRetiro[i].listaEquipos.find(
                      x => x.id === Number(e.target.value)
                    );

                    const nuevos = [...equiposRetiro];

                    nuevos[i] = {
                      ...nuevos[i],
                      equipoId: equipo.id,
                      nombre: equipo.name,
                      ruInicio: equipo.position,
                      cantidadRu: equipo.device_type?.u_height || 1
                    };

                    setEquiposRetiro(nuevos);
                  }}
                >
                  <option value="">Seleccione Equipo</option>

                  {equiposRetiro[i]?.listaEquipos?.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* DATOS */}
            {equiposRetiro[i]?.equipoId && (
              <>
                <div className="form-row">
                  <label>RU inicial</label>
                  <input
                    className="form-control"
                    value={equiposRetiro[i]?.ruInicio}
                    disabled
                  />
                </div>

                <div className="form-row">
                  <label>Cantidad RU</label>
                  <input
                    className="form-control"
                    value={equiposRetiro[i]?.cantidadRu}
                    disabled
                  />
                </div>
              </>
            )}

          </div>
        ))}

      </div>
    </div>
  );
}

export default Instalaciones;