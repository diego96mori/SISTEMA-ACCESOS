import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { netboxGet } from "../Netbox";
import "./Instalaciones.css";

function Instalaciones() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [nodo, setNodo] = useState("");
  const [siteId, setSiteId] = useState(null);
  const [tipoTrabajo, setTipoTrabajo] = useState("");

  const [cantidadEquipos, setCantidadEquipos] = useState(0);

  const [equiposSite, setEquiposSite] = useState([]);

  const [tipoEquipo, setTipoEquipo] = useState("");

  const [equiposFiltrados, setEquiposFiltrados] = useState([]);

  const [equipoSeleccionado, setEquipoSeleccionado] =
    useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {

    if (siteId) {
      cargarEquiposSite();
    }

  }, [siteId]);

  /* ===================================== */
  /* VALIDAR ACCESO */
  /* ===================================== */

  const validarAcceso = async () => {

    const { data } = await supabase
      .rpc(
        "validar_acceso_instalaciones",
        { p_id: Number(id) }
      );

    if (data !== "AUTORIZADO") {

      navigate("/");

      return;
    }

    const { data: accesoData } = await supabase
      .from("accesos")
      .select(`
        nodo_id,
        nodos (
          nombre,
          netbox_site_id
        ),
        tipos_trabajo (
          nombre
        )
      `)
      .eq("id", id)
      .single();

    setNodo(accesoData.nodos.nombre);

    setSiteId(
      accesoData.nodos.netbox_site_id
    );

    setTipoTrabajo(
      accesoData.tipos_trabajo.nombre
    );

    setLoading(false);
  };

  /* ===================================== */
  /* CARGAR EQUIPOS NETBOX */
  /* ===================================== */

  const cargarEquiposSite = async () => {

    try {

      const data = await netboxGet(
        `/dcim/devices/?site_id=${siteId}`
      );

      const equipos = data.results || [];

      setEquiposSite(equipos);

      setCantidadEquipos(equipos.length);

    } catch (err) {

      console.log(err);

      alert("Error cargando equipos");
    }
  };

  /* ===================================== */
  /* OBTENER ALTURA */
  /* ===================================== */

  const obtenerAltura = async (
    deviceTypeId
  ) => {

    try {

      const tipo = await netboxGet(
        `/dcim/device-types/${deviceTypeId}/`
      );

      return tipo.u_height || 1;

    } catch {

      return 1;
    }
  };

  /* ===================================== */
  /* CAMBIO TIPO EQUIPO */
  /* ===================================== */

  const handleTipoEquipo = (valor) => {

    setTipoEquipo(valor);

    setEquipoSeleccionado(null);

    let filtrados = [];

    /* ========================= */
    /* RACKEABLE */
    /* ========================= */

    if (valor === "RACKEABLE") {

      filtrados = equiposSite.filter(
        eq => eq.rack !== null
      );

    } else {

      /* ========================= */
      /* NO RACKEABLE */
      /* ========================= */

      filtrados = equiposSite.filter(
        eq => eq.rack === null
      );
    }

    setEquiposFiltrados(filtrados);
  };

  /* ===================================== */
  /* SELECCIONAR EQUIPO */
  /* ===================================== */

  const handleEquipo = async (
    equipoId
  ) => {

    const equipo = equiposFiltrados.find(
      eq => eq.id === Number(equipoId)
    );

    if (!equipo) return;

    let ruInicio = "-";
    let ruFin = "-";
    let cantidadRu = "-";

    /* ========================= */
    /* SI ES RACKEABLE */
    /* ========================= */

    if (equipo.rack) {

      const altura = await obtenerAltura(
        equipo.device_type.id
      );

      ruInicio = equipo.position || 0;

      ruFin =
        ruInicio + altura - 1;

      cantidadRu =
        ruInicio === ruFin
          ? `${ruInicio}`
          : `${ruInicio} - ${ruFin}`;
    }

    setEquipoSeleccionado({

      equipoId: equipo.id,

      nombre: equipo.name,

      fabricante:
        equipo.device_type?.manufacturer?.name ||
        "-",

      modelo:
        equipo.device_type?.model ||
        "-",

      rack:
        equipo.rack?.name || "NO RACKEABLE",

      ruInicio,

      ruFin,

      cantidadRu
    });
  };

  /* ===================================== */
  /* ENVIAR SOLICITUD */
  /* ===================================== */

  const enviarSolicitud = async () => {

    try {

      if (!equipoSeleccionado) {

        alert(
          "Debe seleccionar un equipo"
        );

        return;
      }

      /* ========================= */
      /* CREAR MOVIMIENTO */
      /* ========================= */

      const {
        data: movimiento,
        error: movError
      } = await supabase
        .from("movimientos")
        .insert({

          acceso_id: Number(id),

          tipo_movimiento:
            tipoTrabajo,

          estado: "PENDIENTE"
        })
        .select()
        .single();

      if (movError) {

        console.log(movError);

        alert(
          "Error creando movimiento"
        );

        return;
      }

      /* ========================= */
      /* DETALLE */
      /* ========================= */

      const {
        error: detalleError
      } = await supabase
        .from("movimiento_detalle")
        .insert({

          movimiento_id:
            movimiento.id,

          accion: "RETIRO",

          equipo_name:
            equipoSeleccionado.nombre,

          equipo_netbox_id:
            equipoSeleccionado.equipoId,

          rack_name:
            equipoSeleccionado.rack,

          ru_inicio:
            equipoSeleccionado.ruInicio === "-"
              ? null
              : equipoSeleccionado.ruInicio,

          ru_fin:
            equipoSeleccionado.ruFin === "-"
              ? null
              : equipoSeleccionado.ruFin
        });

      if (detalleError) {

        console.log(detalleError);

        alert(
          "Error guardando detalle"
        );

        return;
      }

      alert(
        "Solicitud enviada correctamente"
      );

      navigate("/equipos");

    } catch (err) {

      console.log(err);

      alert("Error general");
    }
  };

  /* ===================================== */
  /* LOADING */
  /* ===================================== */

  if (loading) {

    return (
      <h3>
        Validando acceso...
      </h3>
    );
  }

  /* ===================================== */
  /* UI */
  /* ===================================== */

  return (

    <div className="home-container">

      <div className="home-card">

        <h2>
          Gestion de Equipos
        </h2>

        <p>
          ID de Acceso:
          <strong> {id}</strong>
        </p>

        {/* ========================= */}
        {/* NODO */}
        {/* ========================= */}

        <div className="form-row">

          <label>
            Nodo
          </label>

          <input
            value={nodo}
            className="form-control"
            disabled
          />

        </div>

        {/* ========================= */}
        {/* TIPO */}
        {/* ========================= */}

        <div className="form-row">

          <label>
            Tipo de trabajo
          </label>

          <input
            value={tipoTrabajo}
            className="form-control"
            disabled
          />

        </div>

        {/* ========================= */}
        {/* CANTIDAD */}
        {/* ========================= */}

        <div className="form-row">

          <label>
            Equipos disponibles
          </label>

          <input
            className="form-control"
            value={cantidadEquipos}
            disabled
          />

        </div>

        {/* ========================= */}
        {/* TIPO EQUIPO */}
        {/* ========================= */}

        <div className="form-row">

          <label>
            Tipo de equipo
          </label>

          <select
            className="form-control"
            value={tipoEquipo}
            onChange={(e) =>
              handleTipoEquipo(
                e.target.value
              )
            }
          >

            <option value="">
              Seleccione
            </option>

            <option value="RACKEABLE">
              Rackeable
            </option>

            <option value="NO_RACKEABLE">
              No Rackeable
            </option>

          </select>

        </div>

        {/* ========================= */}
        {/* EQUIPO */}
        {/* ========================= */}

        {tipoEquipo && (

          <div className="form-row">

            <label>
              Equipo
            </label>

            <select
              className="form-control"
              onChange={(e) =>
                handleEquipo(
                  e.target.value
                )
              }
            >

              <option value="">
                Seleccione Equipo
              </option>

              {equiposFiltrados.map(eq => (

                <option
                  key={eq.id}
                  value={eq.id}
                >
                  {eq.name}
                </option>

              ))}

            </select>

          </div>
        )}

        {/* ========================= */}
        {/* DETALLE */}
        {/* ========================= */}

        {equipoSeleccionado && (

          <>

            <div className="equipo-box">

              <h5
                style={{
                  color: "red"
                }}
              >
                🔴 Equipo Seleccionado
              </h5>

              {/* FABRICANTE */}

              <div className="form-row">

                <label>
                  Fabricante
                </label>

                <input
                  className="form-control"
                  value={
                    equipoSeleccionado.fabricante
                  }
                  disabled
                />

              </div>

              {/* MODELO */}

              <div className="form-row">

                <label>
                  Modelo
                </label>

                <input
                  className="form-control"
                  value={
                    equipoSeleccionado.modelo
                  }
                  disabled
                />

              </div>

              {/* RACK */}

              <div className="form-row">

                <label>
                  Rack
                </label>

                <input
                  className="form-control"
                  value={
                    equipoSeleccionado.rack
                  }
                  disabled
                />

              </div>

              {/* RU */}

              {tipoEquipo ===
                "RACKEABLE" && (

                <>
                  <div className="form-row">

                    <label>
                      RU Inicial
                    </label>

                    <input
                      className="form-control"
                      value={
                        equipoSeleccionado.ruInicio
                      }
                      disabled
                    />

                  </div>

                  <div className="form-row">

                    <label>
                      Cantidad RU
                    </label>

                    <input
                      className="form-control"
                      value={
                        equipoSeleccionado.cantidadRu
                      }
                      disabled
                    />

                  </div>
                </>
              )}

            </div>

          </>
        )}

        {/* ========================= */}
        {/* BOTON */}
        {/* ========================= */}

        <button
          className="btn btn-success mt-3"
          onClick={enviarSolicitud}
        >
          ENVIAR SOLICITUD
        </button>

      </div>

    </div>
  );
}

export default Instalaciones;