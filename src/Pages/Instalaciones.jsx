import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Instalaciones.css";

function Instalaciones() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [nodo, setNodo] = useState("");
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [nodoId, setNodoId] = useState(null);
  const [tipoTrabajoId, setTipoTrabajoId] = useState(null);
  const [racks, setRacks] = useState([]);
  const [tiposEquipo, setTiposEquipo] = useState([]);
  const [equiposInstalacion, setEquiposInstalacion] = useState([]);
  const [equiposRetiro, setEquiposRetiro] = useState([]);
  const [cantidadEquipos, setCantidadEquipos] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [fibrasIngreso, setFibrasIngreso] = useState([]);

  /* ============================== */
  /* USE EFFECT */
  /* ============================== */

  useEffect(() => {
    validarAcceso();
    cargarTiposEquipo();
  }, []);

 useEffect(() => {
  if (nodoId) {
    cargarRacks();
  }
}, [nodoId]);

  /* ============================== */
  /* VALIDAR ACCESO */
  /* ============================== */

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

  /* ============================== */
  /* CARGAR DATA */
  /* ============================== */
const cargarRacks = async () => {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("nodo_id", nodoId);

  if (error) {
    console.log(error);
    return;
  }

  setRacks(data || []);
};

  const cargarTiposEquipo = async () => {
    const { data } = await supabase
      .from("tipos_equipo")
      .select("*");

    setTiposEquipo(data || []);
  };

const cargarEquipoPorRU = async (rackId, ruNumero) => {
  const { data } = await supabase
    .from("equipos")
    .select(`
      id,
      tipo_equipo_id,
      marca,
      modelo,
      serie,
      tipos_equipo ( nombre )
    `)
    .eq("rack_id", rackId)
    .eq("ru_inicio", ruNumero)
    .eq("estado", "ACTIVO")
    .single();

  return data;
};

const cargarRUInstalacion = async (rackId) => {
  const { data } = await supabase
    .from("rack_ru")
    .select("*")
    .eq("rack_id", rackId)
    .eq("estado", "LIBRE")
    .order("numero_ru");

  return data || [];
};

const cargarRURetiro = async (rackId) => {
  const { data, error } = await supabase
    .from("rack_ru")
    .select("*")
    .eq("rack_id", rackId)
    .eq("estado", "OCUPADO")
    .order("numero_ru");

  if (error) {
    console.log(error);
    return [];
  }

  return data || [];
};
const cargarEquiposActivosNodo = async () => {
  const { data } = await supabase
    .from("equipos")
    .select(`
      id,
      tipo_equipo_id,
      marca,
      modelo,
      serie,
      rack_id,
      ru_inicio,
      tipos_equipo ( nombre )
    `)
    .eq("estado", "ACTIVO")
    .eq("nodo_id", nodoId);

  return data || [];
}

  /* ============================== */
  /* ACTUALIZAR EQUIPO */
  /* ============================== */

const actualizarInstalacion = (index, campo, valor) => {
  const nuevos = [...equiposInstalacion];
  if (!nuevos[index]) nuevos[index] = {};
  nuevos[index][campo] = valor;
  setEquiposInstalacion(nuevos);
};

const actualizarRetiro = (index, campo, valor) => {
  const nuevos = [...equiposRetiro];
  if (!nuevos[index]) nuevos[index] = {};
  nuevos[index][campo] = valor;
  setEquiposRetiro(nuevos);
};

  /* ============================== */
  /* SUBMIT */
  /* ============================== */
const handleSubmit = async (e) => {
  e.preventDefault();

    if (saving) return;
  setSaving(true);

  try {

 
    if (
      (tipoTrabajoId === 1 && equiposInstalacion.length === 0) ||
      (tipoTrabajoId === 2 && equiposRetiro.length === 0) ||
      (tipoTrabajoId === 3 &&
        (equiposInstalacion.length === 0 || equiposRetiro.length === 0))
    ) {
      alert("Debe completar los equipos");
      setSaving(false);
      return;
    }


/* 🔹 VALIDACIÓN REAL DE CAMPOS */

if (tipoTrabajoId === 1) {
  for (let eq of equiposInstalacion) {
    if (!eq?.rackId || !eq?.ruInicio || !eq?.tipoEquipoId) {
      alert("Complete todos los datos de instalación");
      setSaving(false);
      return;
    }
  }
}

if (tipoTrabajoId === 2) {
  for (let eq of equiposRetiro) {
    if (!eq?.equipoId) {
      alert("Complete todos los datos de retiro");
      setSaving(false);
      return;
    }
  }
}

if (tipoTrabajoId === 3) {
  for (let i = 0; i < cantidadEquipos; i++) {

    const ret = equiposRetiro[i];
    const inst = equiposInstalacion[i];

    if (!ret?.equipoId) {
      alert("Complete datos de RETIRO en reemplazo");
      setSaving(false);
      return;
    }

    if (!inst?.rackId || !inst?.ruInicio || !inst?.cantidadRu) {
      alert("Complete datos de INSTALACIÓN en reemplazo");
      setSaving(false);
      return;
    }
  }
}

/* 🔴 👉 AQUÍ VA LA VALIDACIÓN TIPO 4 */

if (tipoTrabajoId === 4) {

  if (!fibrasIngreso.length) {
    alert("Debe ingresar fibras");
    setSaving(false);
    return;
  }

  for (let fibra of fibrasIngreso) {

    if (!fibra?.tipoFibra) {
      alert("Seleccione tipo de fibra");
      setSaving(false);
      return;
    }

    for (let panel of fibra.panels || []) {
      if (!panel?.rackId || !panel?.ruInicio || !panel?.cantidadRu) {
        alert("Complete todos los datos del PatchPanel");
        setSaving(false);
        return;
      }
    }
  }
}


let instalacionesFinal = equiposInstalacion;

if (tipoTrabajoId === 4) {

  instalacionesFinal = [];

  const patchPanelTipo = tiposEquipo.find(
    t => t.nombre === "PATCH PANEL"
  );

  const fibraTipo = tiposEquipo.find(
    t => t.nombre === "FIBRA OPTICA"
  );

  if (!patchPanelTipo || !fibraTipo) {
    alert("Tipos de equipo no configurados");
    setSaving(false);
    return;
  }

  fibrasIngreso.forEach(fibra => {

    // 🔵 1️⃣ INSERTAR FIBRA OPTICA (SIN RACK)
    instalacionesFinal.push({
      rackId: null,
      ruInicio: null,
      cantidadRu: null,
      tipoEquipoId: fibraTipo.id,
      marca: null,
      modelo: null,
      serie: null,
      cantidad_hilos: Number(fibra.tipoFibra)
    });

    // 🟢 2️⃣ INSERTAR PATCH PANEL
    fibra.panels?.forEach(panel => {

      instalacionesFinal.push({
        rackId: panel.rackId,
        ruInicio: panel.ruInicio,
        cantidadRu: panel.cantidadRu || 1,
        tipoEquipoId: patchPanelTipo.id,
        marca: null,
  modelo: null,
  serie: null
      });

    });

  });

}
const payload = {
  acceso_id: Number(id),
  tipo_trabajo_id: tipoTrabajoId,
  instalaciones: instalacionesFinal,
  retiros: equiposRetiro
};

    const { error } = await supabase
      .rpc("procesar_movimiento", {
        p_data: payload
      });

    if (error) throw error;

    alert("Proceso registrado correctamente");
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

  /* ============================== */
  /* RETURN */
  /* ============================== */

  return (
    <>
      <div className="home-container">
        <div className="home-card">

          <h2 style={{ marginBottom: "10px" }}>
            Gestion de Equipos 
          </h2>

          <p style={{ marginBottom: "25px", opacity: 0.6 }}>
            ID de Acceso: <strong>{id}</strong>
          </p>

          <form onSubmit={handleSubmit}>

            {/* NODO */}
            <div className="form-row">
              <label>Nodo</label>
              <input value={nodo} className="form-control" disabled />
            </div>

            {/* TIPO TRABAJO */}
            <div className="form-row">
              <label>Tipo de trabajo</label>
              <input value={tipoTrabajo} className="form-control" disabled />
            </div>

            {/* CANTIDAD */}
            <div className="form-row">
              <label>
  {tipoTrabajoId === 4 ? "N° de fibras" : "N° de equipos"}
</label>
              <select
                className="form-control"
                value={cantidadEquipos}
                onChange={(e) =>
                  setCantidadEquipos(Number(e.target.value))
                }
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

{/* EQUIPOS DINÁMICOS */}

{/* 🔵 INSTALACIÓN / RETIRO SIMPLE */}
{tipoTrabajoId === 1 &&
  Array.from({ length: cantidadEquipos }).map((_, i) => {

    const equipoSeleccionado = tiposEquipo.find(
      t => Number(t.id) === Number(equiposInstalacion[i]?.tipoEquipoId)
    );

    return (
      <div key={i} className="equipo-box">

        <h5 style={{ color: "green", marginBottom: "15px" }}>
          🟢 Equipo a Instalar {i + 1}
        </h5>
    

        {/* SELECT EQUIPO */}
        <div className="form-row">
          <label>Equipo</label>
          <select
            className="form-control"
            value={equiposInstalacion[i]?.tipoEquipoId || ""}
            onChange={(e) => {
              actualizarInstalacion(i, "tipoEquipoId", Number(e.target.value));
              actualizarInstalacion(i, "rackId", null);
              actualizarInstalacion(i, "ruInicio", null);
              actualizarInstalacion(i, "ruOptions", []);
            }}
          >
            <option value="">Seleccione Equipo</option>
            {tiposEquipo.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        {/* 🔹 MARCA */}
        {equipoSeleccionado && (
          <div className="form-row">
            <label>Marca</label>
            <input
              className="form-control"
              value={equiposInstalacion[i]?.marca || ""}
              onChange={(e) =>
                actualizarInstalacion(i, "marca", e.target.value)
              }
            />
          </div>
        )}

        {/* 🔹 MODELO */}
        {equipoSeleccionado && (
          <div className="form-row">
            <label>Modelo</label>
            <input
              className="form-control"
              value={equiposInstalacion[i]?.modelo || ""}
              onChange={(e) =>
                actualizarInstalacion(i, "modelo", e.target.value)
              }
            />
          </div>
        )}

        {/* 🔹 SERIE */}
        {equipoSeleccionado && (
          <div className="form-row">
            <label>Serie</label>
            <input
              className="form-control"
              value={equiposInstalacion[i]?.serie || ""}
              onChange={(e) =>
                actualizarInstalacion(i, "serie", e.target.value)
              }
            />
          </div>
        )}

        {/* 🔹 SI USA RACK */}
        {equipoSeleccionado?.usa_rack && (
          <>
            <div className="form-row">
              <label>Rack</label>
              <select
                className="form-control"
                value={equiposInstalacion[i]?.rackId || ""}
                onChange={async (e) => {
                  const rackId = Number(e.target.value);
                  actualizarInstalacion(i, "rackId", rackId);
                  actualizarInstalacion(i, "ruInicio", null);

                  const ruData = await cargarRUInstalacion(rackId);
                  actualizarInstalacion(i, "ruOptions", ruData);
                }}
              >
                <option value="">Seleccione Rack</option>
                {racks.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {equipoSeleccionado.usa_ru && (
              <>
                <div className="form-row">
                  <label>RU inicial</label>
                  <select
                    className="form-control"
                    value={equiposInstalacion[i]?.ruInicio || ""}
                    onChange={(e) =>
                      actualizarInstalacion(i, "ruInicio", Number(e.target.value))
                    }
                  >
                    <option value="">Seleccione RU</option>
                    {equiposInstalacion[i]?.ruOptions?.map(ru => (
                      <option key={ru.id} value={ru.numero_ru}>
                        RU {ru.numero_ru}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label>Cantidad de RU</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={equiposInstalacion[i]?.cantidadRu ?? 1}
                    onChange={(e) =>
                      actualizarInstalacion(i, "cantidadRu", Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}
          </>
        )}

      </div>
    );
  })
}

{/* RETIRO DE EQUIPOS */}



{tipoTrabajoId === 2 &&
  Array.from({ length: cantidadEquipos }).map((_, i) => {

    return (
      <div key={i} className="equipo-box">

        <h5 style={{ color: "red", marginBottom: "15px" }}>
          🔴 Equipo a Retirar {i + 1}
        </h5>

        {/* 🔹 SELECCIONAR RACK */}
        <div className="form-row">
          <label>Rack</label>
          <select
            className="form-control"
            value={equiposRetiro[i]?.rackId || ""}
            onChange={async (e) => {
              const rackId = Number(e.target.value);

              actualizarRetiro(i, "rackId", rackId);
              actualizarRetiro(i, "equipoId", null);

              const { data } = await supabase
                .from("equipos")
                .select("*")
                .eq("rack_id", rackId)
                .eq("estado", "ACTIVO");

              const nuevos = [...equiposRetiro];
              nuevos[i] = {
                ...nuevos[i],
                listaEquipos: data || []
              };

              setEquiposRetiro(nuevos);
            }}
          >
            <option value="">Seleccione Rack</option>
            {racks.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>

        {/* 🔹 SELECCIONAR EQUIPO REAL */}
        {equiposRetiro[i]?.rackId && (
          <div className="form-row">
            <label>Equipo</label>
            <select
              className="form-control"
              value={equiposRetiro[i]?.equipoId || ""}
              onChange={(e) => {

                const equipo = equiposRetiro[i].listaEquipos.find(
                  x => x.id == e.target.value
                );

                const nuevos = [...equiposRetiro];

                nuevos[i] = {
                  ...nuevos[i],
                  equipoId: equipo.id,
                  marca: equipo.marca,
                  modelo: equipo.modelo,
                  serie: equipo.serie,
                  ruInicio: equipo.ru_inicio,
                  cantidadRu: equipo.cantidad_ru
                };

                setEquiposRetiro(nuevos);
              }}
            >
              <option value="">Seleccione Equipo</option>

              {equiposRetiro[i]?.listaEquipos?.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.marca} - {eq.modelo} - {eq.serie}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 🔹 DATOS AUTOMÁTICOS */}
        {equiposRetiro[i]?.equipoId && (
          <>
            <div className="form-row">
              <label>Marca</label>
              <input
                className="form-control"
                value={equiposRetiro[i]?.marca || ""}
                disabled
              />
            </div>

            <div className="form-row">
              <label>Modelo</label>
              <input
                className="form-control"
                value={equiposRetiro[i]?.modelo || ""}
                disabled
              />
            </div>

            <div className="form-row">
              <label>Serie</label>
              <input
                className="form-control"
                value={equiposRetiro[i]?.serie || ""}
                disabled
              />
            </div>

            <div className="form-row">
              <label>RU inicial</label>
              <input
                className="form-control"
                value={equiposRetiro[i]?.ruInicio || ""}
                disabled
              />
            </div>

            <div className="form-row">
              <label>Cantidad RU</label>
              <input
                className="form-control"
                value={equiposRetiro[i]?.cantidadRu || ""}
                disabled
              />
            </div>
          </>
        )}

      </div>
    );
  })
}




{/* 🟣 REEMPLAZO */}
{tipoTrabajoId === 3 &&
  Array.from({ length: cantidadEquipos }).map((_, i) => {

    const equipoRetiro = tiposEquipo.find(
      t => Number(t.id) === Number(equiposRetiro[i]?.tipoEquipoId)
    );

    const equipoInstalacion = tiposEquipo.find(
      t => Number(t.id) === Number(equiposInstalacion[i]?.tipoEquipoId)
    );

    return (
      <div key={i} className="equipo-box">


<h5 style={{ color: "red" }}>🔴 Equipo a Retirar</h5>

{/* 🔹 RACK */}
<div className="form-row">
  <label>Rack</label>
  <select
    className="form-control"
    value={equiposRetiro[i]?.rackId || ""}
    onChange={async (e) => {
      const rackId = Number(e.target.value);

      actualizarRetiro(i, "rackId", rackId);
      actualizarRetiro(i, "equipoId", null);

      const { data } = await supabase
        .from("equipos")
        .select("*")
        .eq("rack_id", rackId)
        .eq("estado", "ACTIVO");

      const nuevos = [...equiposRetiro];
      nuevos[i] = {
        ...nuevos[i],
        listaEquipos: data || []
      };

      setEquiposRetiro(nuevos);
    }}
  >
    <option value="">Seleccione Rack</option>
    {racks.map(r => (
      <option key={r.id} value={r.id}>{r.nombre}</option>
    ))}
  </select>
</div>

{/* 🔹 EQUIPO */}
{equiposRetiro[i]?.rackId && (
  <div className="form-row">
    <label>Equipo</label>
    <select
      className="form-control"
      value={equiposRetiro[i]?.equipoId || ""}
      onChange={(e) => {

        const equipo = equiposRetiro[i].listaEquipos.find(
          x => x.id == e.target.value
        );

        const nuevos = [...equiposRetiro];

        nuevos[i] = {
          ...nuevos[i],
          equipoId: equipo.id,
          marca: equipo.marca,
          modelo: equipo.modelo,
          serie: equipo.serie,
          ruInicio: equipo.ru_inicio,
          cantidadRu: equipo.cantidad_ru
        };

        setEquiposRetiro(nuevos);
      }}
    >
      <option value="">Seleccione Equipo</option>

      {equiposRetiro[i]?.listaEquipos?.map(eq => (
        <option key={eq.id} value={eq.id}>
          {eq.marca} - {eq.modelo} - {eq.serie}
        </option>
      ))}
    </select>
  </div>
)}

{/* 🔹 INFO AUTOMÁTICA */}
{equiposRetiro[i]?.equipoId && (
  <>
    <div className="form-row">
      <label>Marca</label>
      <input value={equiposRetiro[i]?.marca || ""} disabled />
    </div>

    <div className="form-row">
      <label>Modelo</label>
      <input value={equiposRetiro[i]?.modelo || ""} disabled />
    </div>

    <div className="form-row">
      <label>Serie</label>
      <input value={equiposRetiro[i]?.serie || ""} disabled />
    </div>

    <div className="form-row">
      <label>RU inicial</label>
      <input value={equiposRetiro[i]?.ruInicio || ""} disabled />
    </div>

    <div className="form-row">
      <label>Cantidad RU</label>
      <input value={equiposRetiro[i]?.cantidadRu || ""} disabled />
    </div>
  </>
)}

       

        <hr />

        {/* 🟢 EQUIPO A INSTALAR */}
        <h5 style={{ color: "green" }}>🟢 Equipo a Instalar</h5>

        <div className="form-row">
          <label>Equipo</label>
          <select
            className="form-control"
            value={equiposInstalacion[i]?.tipoEquipoId || ""}
            onChange={(e) => {
              actualizarInstalacion(i, "tipoEquipoId", Number(e.target.value));
              actualizarInstalacion(i, "rackId", null);
              actualizarInstalacion(i, "ruInicio", null);
              actualizarInstalacion(i, "ruOptions", []);
            }}
          >
            <option value="">Seleccione Equipo</option>
            {tiposEquipo.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        {/* Marca / Modelo / Serie */}
        {equipoInstalacion && (
          <>
            <div className="form-row">
              <label>Marca</label>
              <input
                className="form-control"
                value={equiposInstalacion[i]?.marca || ""}
                onChange={(e) =>
                  actualizarInstalacion(i, "marca", e.target.value)
                }
              />
            </div>

            <div className="form-row">
              <label>Modelo</label>
              <input
                className="form-control"
                value={equiposInstalacion[i]?.modelo || ""}
                onChange={(e) =>
                  actualizarInstalacion(i, "modelo", e.target.value)
                }
              />
            </div>

            <div className="form-row">
              <label>Serie</label>
              <input
                className="form-control"
                value={equiposInstalacion[i]?.serie || ""}
                onChange={(e) =>
                  actualizarInstalacion(i, "serie", e.target.value)
                }
              />
            </div>
          </>
        )}

        {/* Si usa Rack → RU LIBRES + RU RETIRADAS */}
        {equipoInstalacion?.usa_rack && (
          <>
            <div className="form-row">
              <label>Rack</label>
              <select
                className="form-control"
                value={equiposInstalacion[i]?.rackId || ""}
                onChange={async (e) => {
                  const rackId = Number(e.target.value);
                  actualizarInstalacion(i, "rackId", rackId);
                  actualizarInstalacion(i, "ruInicio", null);

                  const ruLibres = await cargarRUInstalacion(rackId);

                  const ruRetirada = [];

if (equiposRetiro[i]?.ruInicio && equiposRetiro[i]?.cantidadRu) {
  for (let k = 0; k < equiposRetiro[i].cantidadRu; k++) {
    ruRetirada.push({
      numero_ru: equiposRetiro[i].ruInicio + k
    });
  }
}

                 const ruCombinadas = [...ruLibres, ...ruRetirada];

ruCombinadas.sort((a, b) => a.numero_ru - b.numero_ru);

actualizarInstalacion(i, "ruOptions", ruCombinadas);
                }}
              >
                <option value="">Seleccione Rack</option>
                {racks.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {equipoInstalacion.usa_ru && (
              <>
                <div className="form-row">
                  <label>RU inicial</label>
                  <select
                    className="form-control"
                    value={equiposInstalacion[i]?.ruInicio || ""}
                    onChange={(e) =>
                      actualizarInstalacion(i, "ruInicio", Number(e.target.value))
                    }
                  >
                    <option value="">Seleccione RU</option>
                    {equiposInstalacion[i]?.ruOptions?.map((ru, idx) => (
                      <option key={idx} value={ru.numero_ru}>
                        RU {ru.numero_ru}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label>Cantidad de RU</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={equiposInstalacion[i]?.cantidadRu ?? 1}
                    onChange={(e) =>
                      actualizarInstalacion(i, "cantidadRu", Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}
          </>
        )}

      </div>
    );
  })
}
{tipoTrabajoId === 4 &&
  Array.from({ length: cantidadEquipos }).map((_, i) => {

    const fibra = fibrasIngreso[i] || { tipoFibra: "", panels: [] };
    const totalPanels =
      fibra.tipoFibra === "96"
        ? 2
        : fibra.tipoFibra === "48"
        ? 1
        : 0;

    return (
      <div key={i} className="equipo-box">

        <h5 style={{
  textAlign: "center",
  color: "#007bff",
  fontWeight: "600",
  marginBottom: "15px"
}}>
         🔵 Fibra Optica {i + 1}
        </h5>

        {/* TIPO FIBRA */}
        <div className="form-row">
         <label style={{ marginBottom: "6px", display: "block" }}>
   N° de Hilos
</label>
          <select
            className="form-control"
            value={fibra.tipoFibra}
            onChange={(e) => {
  const valor = e.target.value;
  const nuevos = [...fibrasIngreso];

  const totalPanels =
    valor === "96" ? 2 :
    valor === "48" ? 1 : 0;

  nuevos[i] = {
    tipoFibra: valor,
    panels: Array.from({ length: totalPanels }).map(() => ({
      rackId: null,
      ruInicio: null,
      cantidadRu: 1,
      ruOptions: []
    }))
  };

  setFibrasIngreso(nuevos);
}}
          >
            <option value="">Seleccione</option>
            <option value="48">48 Hilos</option>
            <option value="96">96 Hilos</option>
          </select>
        </div>

        {/* PATCH PANELS */}
        {Array.from({ length: totalPanels }).map((_, pIndex) => {

          const panel = fibra.panels?.[pIndex] || {};

          return (
            <div key={pIndex} style={{ marginTop: "15px" }}>

              <h6>PatchPanel {pIndex + 1}</h6>

              {/* RACK */}
              <div className="form-row">
                <label>Rack</label>
                <select
                  className="form-control"
                  value={panel.rackId || ""}
                  onChange={async (e) => {

                    const rackId = Number(e.target.value);
                    const ruLibres = await cargarRUInstalacion(rackId);

                    const nuevos = [...fibrasIngreso];
                    if (!nuevos[i]) nuevos[i] = { tipoFibra: fibra.tipoFibra, panels: [] };
                    if (!nuevos[i].panels) nuevos[i].panels = [];

                    nuevos[i].panels[pIndex] = {
                      rackId,
                      ruInicio: null,
                      cantidadRu: 1,
                      ruOptions: ruLibres
                    };

                    setFibrasIngreso(nuevos);
                  }}
                >
                  <option value="">Seleccione Rack</option>
                  {racks.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* RU INICIAL */}
              {panel.ruOptions && (
                <div className="form-row">
                  <label>RU inicial</label>
                  <select
                    className="form-control"
                    value={panel.ruInicio || ""}
                    onChange={(e) => {

                      const nuevos = [...fibrasIngreso];
                      nuevos[i].panels[pIndex].ruInicio =
                        Number(e.target.value);

                      setFibrasIngreso(nuevos);
                    }}
                  >
                    <option value="">Seleccione RU</option>

                    {panel.ruOptions
                      .filter(ru => {

                        const rusUsadas =
                          fibra.panels
                            ?.filter((_, idx) => idx !== pIndex)
                            .flatMap(eq => {
                              if (!eq?.ruInicio) return [];
                              return Array.from(
                                { length: eq.cantidadRu || 1 },
                                (_, k) => eq.ruInicio + k
                              );
                            }) || [];

                        return !rusUsadas.includes(ru.numero_ru);
                      })
                      .map(ru => (
                        <option key={ru.id} value={ru.numero_ru}>
                          RU {ru.numero_ru}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* CANTIDAD RU */}
              
                <div className="form-row">
  <label>Cantidad de RU</label>
  <input
    type="number"
    min="1"
    className="form-control"
    value={panel.cantidadRu || 1}
    onChange={(e) => {

      const nuevos = [...fibrasIngreso];
      nuevos[i].panels[pIndex].cantidadRu =
        Number(e.target.value);

      setFibrasIngreso(nuevos);
    }}
  />
</div>
              

            </div>
          );
        })}

      </div>
    );
  })
}

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

export default Instalaciones;