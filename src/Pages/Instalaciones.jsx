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

  const [cantidadEquipos, setCantidadEquipos] =
    useState(0);

  const [cantidadSeleccionada,
    setCantidadSeleccionada] =
    useState("");

  const [equiposSite, setEquiposSite] =
    useState([]);

  const [equiposRetiro,
    setEquiposRetiro] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

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

    const { data: accesoData } =
      await supabase
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

    setNodo(
      accesoData.nodos.nombre
    );

    setSiteId(
      accesoData.nodos.netbox_site_id
    );

    setTipoTrabajo(
      accesoData.tipos_trabajo.nombre
    );

    setLoading(false);
  };

  /* ===================================== */
  /* NETBOX */
  /* ===================================== */

  const cargarEquiposSite =
    async () => {

      try {

        const data =
          await netboxGet(
            `/dcim/devices/?site_id=${siteId}`
          );

        const equipos =
          data.results || [];

        setEquiposSite(equipos);

        setCantidadEquipos(
          equipos.length
        );

      } catch (err) {

        console.log(err);

        alert(
          "Error cargando equipos"
        );
      }
    };

  /* ===================================== */
  /* ALTURA */
  /* ===================================== */

  const obtenerAltura =
    async (deviceTypeId) => {

      try {

        const tipo =
          await netboxGet(
            `/dcim/device-types/${deviceTypeId}/`
          );

        return tipo.u_height || 1;

      } catch {

        return 1;
      }
    };

  /* ===================================== */
  /* CANTIDAD */
  /* ===================================== */

  const handleCantidad =
    (cantidad) => {

      setCantidadSeleccionada(
        cantidad
      );

      const nuevos = [];

      for (
        let i = 0;
        i < Number(cantidad);
        i++
      ) {

        nuevos.push({

          tipoEquipo: "",

          listaEquipos: [],

          equipoId: "",

          equipoNombre: "",

          fabricante: "",

          modelo: "",

          rack: "",

          ruInicio: "",

          cantidadRu: ""
        });
      }

      setEquiposRetiro(nuevos);
    };

  /* ===================================== */
  /* TIPO EQUIPO */
  /* ===================================== */

  const handleTipoEquipo =
    (index, valor) => {

      const nuevos =
        [...equiposRetiro];

      nuevos[index].tipoEquipo =
        valor;

      nuevos[index].equipoId = "";

      const usados =
        nuevos
          .map(x => x.equipoId)
          .filter(Boolean);

      let filtrados = [];

      /* ========================= */
      /* RACKEABLE */
      /* ========================= */

      if (valor === "RACKEABLE") {

        filtrados =
          equiposSite.filter(eq =>
            eq.rack !== null
          );

      } else {

        /* ========================= */
        /* NO RACKEABLE */
        /* ========================= */

        filtrados =
          equiposSite.filter(eq =>
            eq.rack === null
          );
      }

      /* ========================= */
      /* QUITAR REPETIDOS */
      /* ========================= */

      filtrados =
        filtrados.filter(
          eq =>
            !usados.includes(eq.id)
        );

      nuevos[index].listaEquipos =
        filtrados;

      setEquiposRetiro(nuevos);
    };

  /* ===================================== */
  /* EQUIPO */
  /* ===================================== */

  const handleEquipo =
    async (index, equipoId) => {

      const nuevos =
        [...equiposRetiro];

      const equipo =
        nuevos[index]
          .listaEquipos
          .find(
            eq =>
              eq.id ===
              Number(equipoId)
          );

      if (!equipo) return;

      let ruInicio = "-";

      let ruFin = "-";

      let cantidadRu = "-";

      /* ========================= */
      /* RACKEABLE */
      /* ========================= */

      if (equipo.rack) {

        const altura =
          await obtenerAltura(
            equipo.device_type.id
          );

        ruInicio =
          equipo.position || 0;

        ruFin =
          ruInicio + altura - 1;

        cantidadRu =
          ruInicio === ruFin
            ? `${ruInicio}`
            : `${ruInicio} - ${ruFin}`;
      }

      nuevos[index] = {

        ...nuevos[index],

        equipoId:
          equipo.id,

        equipoNombre:
          equipo.name,

        fabricante:
          equipo.device_type
            ?.manufacturer?.name || "-",

        modelo:
          equipo.device_type
            ?.model || "-",

        rack:
          equipo.rack?.name || "",

        ruInicio,

        cantidadRu
      };

      setEquiposRetiro(nuevos);
    };

  /* ===================================== */
  /* ENVIAR */
  /* ===================================== */

  const enviarSolicitud =
    async () => {

      try {

        if (
          equiposRetiro.length === 0
        ) {

          alert(
            "Debe seleccionar equipos"
          );

          return;
        }

        const incompletos =
          equiposRetiro.some(
            eq => !eq.equipoId
          );

        if (incompletos) {

          alert(
            "Complete todos los equipos"
          );

          return;
        }

        /* ========================= */
        /* MOVIMIENTO */
        /* ========================= */

        const {
          data: movimiento,
          error: movError
        } = await supabase
          .from("movimientos")
          .insert({

            acceso_id:
              Number(id),

            tipo_movimiento:
              tipoTrabajo,

            estado:
              "PENDIENTE"
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
        /* DETALLES */
        /* ========================= */

        const detalles =
          equiposRetiro.map(eq => ({

            movimiento_id:
              movimiento.id,

            accion:
              "RETIRO",

            equipo_name:
              eq.equipoNombre,

            equipo_netbox_id:
              eq.equipoId,

            rack_name:
              eq.rack || null,

            ru_inicio:

              eq.ruInicio === "-" ||
              eq.ruInicio === "" ||
              eq.ruInicio === null

                ? null

                : Number(eq.ruInicio),

            ru_fin:

              typeof eq.cantidadRu ===
              "string" &&
              eq.cantidadRu.includes("-")

                ? Number(
                    eq.cantidadRu
                      .split("-")[1]
                      .trim()
                  )

                : (
                    eq.ruInicio === "-"
                      ? null
                      : eq.ruInicio
                  )
          }));

        const {
          error: detalleError
        } = await supabase
          .from("movimiento_detalle")
          .insert(detalles);

        if (detalleError) {

          console.log(
            detalleError
          );

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

        {/* NODO */}

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

        {/* TIPO */}

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

        {/* CANTIDAD */}

        <div className="form-row">

          <label>
            Cantidad de equipos
          </label>

          <select
            className="form-control"
            value={
              cantidadSeleccionada
            }
            onChange={(e) =>
              handleCantidad(
                e.target.value
              )
            }
          >

            <option value="">
              Seleccione
            </option>

            {Array.from({
              length:
                cantidadEquipos
            }).map((_, i) => (

              <option
                key={i + 1}
                value={i + 1}
              >
                {i + 1}
              </option>

            ))}

          </select>

        </div>

        {/* BLOQUES */}

        {equiposRetiro.map(
          (item, index) => (

          <div
            key={index}
            className="equipo-box"
          >

            <h5
              style={{
                color: "red"
              }}
            >
              🔴 Equipo {index + 1}
            </h5>

            {/* TIPO */}

            <div className="form-row">

              <label>
                Tipo de equipo
              </label>

              <select
                className="form-control"
                value={
                  item.tipoEquipo
                }
                onChange={(e) =>
                  handleTipoEquipo(
                    index,
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

            {/* EQUIPO */}

            {item.tipoEquipo && (

              <div className="form-row">

                <label>
                  Equipo
                </label>

                <select
                  className="form-control"
                  value={
                    item.equipoId
                  }
                  onChange={(e) =>
                    handleEquipo(
                      index,
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Seleccione Equipo
                  </option>

                  {item.listaEquipos
                    .map(eq => (

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

            {/* DETALLE */}

            {item.equipoId && (

              <>

                {/* FABRICANTE */}

                <div className="form-row">

                  <label>
                    Fabricante
                  </label>

                  <input
                    className="form-control"
                    value={
                      item.fabricante
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
                      item.modelo
                    }
                    disabled
                  />

                </div>

                {/* SOLO SI ES RACKEABLE */}

                {item.tipoEquipo ===
                  "RACKEABLE" && (

                  <>
                    {/* RACK */}

                    <div className="form-row">

                      <label>
                        Rack
                      </label>

                      <input
                        className="form-control"
                        value={
                          item.rack
                        }
                        disabled
                      />

                    </div>

                    {/* RU */}

                    <div className="form-row">

                      <label>
                        RU Inicial
                      </label>

                      <input
                        className="form-control"
                        value={
                          item.ruInicio
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
                          item.cantidadRu
                        }
                        disabled
                      />

                    </div>
                  </>
                )}

              </>
            )}

          </div>
        ))}

        {/* BOTON */}

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