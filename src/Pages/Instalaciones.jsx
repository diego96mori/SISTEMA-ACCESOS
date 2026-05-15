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

  const [movimientoExistente,
    setMovimientoExistente] =
    useState(null);

  const [modoLectura,
    setModoLectura] =
    useState(false);

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

    /* ===================================== */
    /* VERIFICAR SI YA EXISTE */
    /* ===================================== */

    const {
      data: movimientoData
    } = await supabase
      .from("movimientos")
      .select(`
        *,
        movimiento_detalle (*)
      `)
      .eq("acceso_id", Number(id))
      .single();

    if (movimientoData) {

      setMovimientoExistente(
        movimientoData
      );

      setModoLectura(true);

      setCantidadSeleccionada(
        movimientoData
          .movimiento_detalle
          .length
      );

      const equipos =
        movimientoData
          .movimiento_detalle
          .map(det => ({

            tipoEquipo:
              det.rack_name
                ? "RACKEABLE"
                : "NO_RACKEABLE",

            listaEquipos: [],

            equipoId:
              det.equipo_netbox_id,

            equipoNombre:
              det.equipo_name,

            fabricante: "",

            modelo: "",

            rack:
              det.rack_name || "",

            rackNetboxId:
              det.rack_netbox_id,

            ruInicio:
              det.ru_inicio || "",

            cantidadRu:

              det.ru_inicio &&
              det.ru_fin

                ? det.ru_inicio === det.ru_fin

                  ? `${det.ru_inicio}`

                  : `${det.ru_inicio} - ${det.ru_fin}`

                : ""
          }));

      setEquiposRetiro(equipos);
    }

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

          rackNetboxId: null,

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

      if (valor === "RACKEABLE") {

        filtrados =
          equiposSite.filter(eq =>
            eq.rack !== null
          );

      } else {

        filtrados =
          equiposSite.filter(eq =>
            eq.rack === null
          );
      }

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

      /* ===================================== */
      /* RACKEABLE */
      /* ===================================== */
if (equipo.rack) {

  ruInicio =
    equipo.position || 0;

  // 🔥 ALTURA REAL
  let altura = 1;

  // intenta leer altura del NetBox
  if (
    equipo.device_type?.u_height
  ) {

    altura = Number(
      equipo.device_type.u_height
    );
  }

  // fallback manual para OLT Huawei
  if (
    equipo.name?.includes("MA5800")
  ) {

    altura = 10;
  }

  ruFin =
    ruInicio + altura - 1;

  cantidadRu =
    `${ruInicio} - ${ruFin}`;
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

        rackNetboxId:
          equipo.rack?.id || null,

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

            rack_netbox_id:
              eq.rackNetboxId,

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
            detalleError.message
          );

          return;
        }

        alert(
          "Solicitud enviada correctamente"
        );

        window.location.reload();

      } catch (err) {

        console.log(err);

        alert("Error general");
      }
    };

  if (loading) {

    return (
      <h3>
        Validando acceso...
      </h3>
    );
  }

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
            disabled={modoLectura}
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
                disabled={modoLectura}
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
                  disabled={modoLectura}
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

                  {modoLectura ? (

                    <option value={item.equipoId}>
                      {item.equipoNombre}
                    </option>

                  ) : (

                    item.listaEquipos
                      .map(eq => (

                      <option
                        key={eq.id}
                        value={eq.id}
                      >
                        {eq.name}
                      </option>

                    ))
                  )}

                </select>

              </div>
            )}

            {/* DETALLES */}

            {item.equipoId && (

              <>

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

                {/* SOLO SI RACKEABLE */}

                {item.tipoEquipo ===
                  "RACKEABLE" && (

                  <>

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

        {!modoLectura ? (

          <button
            className="btn btn-success mt-3"
            onClick={enviarSolicitud}
          >
            ENVIAR SOLICITUD
          </button>

        ) : (

          <div
            style={{
              marginTop: "20px",
              fontWeight: "bold",
              color:

                movimientoExistente
                  ?.estado === "APROBADO"

                    ? "green"

                    : movimientoExistente
                      ?.estado === "DENEGADO"

                        ? "red"

                        : "orange"
            }}
          >

            SOLICITUD {
              movimientoExistente
                ?.estado
            }

          </div>
        )}

      </div>

    </div>
  );
}

export default Instalaciones;