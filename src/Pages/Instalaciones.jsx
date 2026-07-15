import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  consultarCatalogoNetbox,
  obtenerContextoEquipos,
  registrarMovimientoEquipos,
} from "../services/equipos";
import "./Instalaciones.css";

function emptyItem() {
  return {
    retiroTipo: "",
    retiroId: "",
    retiro: null,
    instalacionRackeable: "",
    fabricanteId: "",
    fabricante: "",
    modeloId: "",
    modelo: "",
    cantidadRu: 1,
    nombrePropuesto: "",
    modelos: [],
  };
}

function Instalaciones() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [contexto, setContexto] = useState(null);
  const [equiposNetbox, setEquiposNetbox] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [cantidad, setCantidad] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const context = await obtenerContextoEquipos(codigo);
      setContexto(context);

      if (context.movimiento_id) return;

      const needsExisting = ["RETIRO", "REEMPLAZO"].includes(
        context.tipo_movimiento,
      );
      const needsNew = ["INSTALACION", "REEMPLAZO", "INGRESO_FO"].includes(
        context.tipo_movimiento,
      );

      const [devices, manufacturers] = await Promise.all([
        needsExisting
          ? consultarCatalogoNetbox(codigo, "equipos")
          : Promise.resolve([]),
        needsNew
          ? consultarCatalogoNetbox(codigo, "fabricantes")
          : Promise.resolve([]),
      ]);
      setEquiposNetbox(devices);
      setFabricantes(manufacturers);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarCantidad = (value) => {
    const parsed = Number(value);
    setCantidad(value);
    setItems(
      Number.isInteger(parsed) && parsed >= 1 && parsed <= 50
        ? Array.from({ length: parsed }, emptyItem)
        : [],
    );
  };

  const updateItem = (index, changes) => {
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...changes } : item
    ));
  };

  const seleccionarRetiro = (index, deviceId) => {
    const device = equiposNetbox.find((item) => item.id === Number(deviceId));
    updateItem(index, { retiroId: deviceId, retiro: device ?? null });
  };

  const seleccionarFabricante = async (index, manufacturerId) => {
    const manufacturer = fabricantes.find(
      (item) => item.id === Number(manufacturerId),
    );
    updateItem(index, {
      fabricanteId: manufacturerId,
      fabricante: manufacturer?.name ?? "",
      modeloId: "",
      modelo: "",
      modelos: [],
    });

    if (!manufacturerId) return;

    try {
      const modelos = await consultarCatalogoNetbox(codigo, "modelos", {
        fabricante_id: Number(manufacturerId),
      });
      updateItem(index, { modelos });
    } catch (catalogError) {
      setError(catalogError.message);
    }
  };

  const seleccionarModelo = (index, modelId) => {
    const item = items[index];
    const model = item.modelos.find((option) => option.id === Number(modelId));
    updateItem(index, {
      modeloId: modelId,
      modelo: model?.model ?? "",
      cantidadRu: Number(model?.u_height) || 1,
    });
  };

  const retiroDetail = (item, index, replacement = false) => {
    const device = item.retiro;
    return {
      numero_item: index + 1,
      grupo_reemplazo: replacement ? index + 1 : null,
      accion: "RETIRO",
      es_rackeable: Boolean(device.rack),
      equipo_anterior_netbox_id: device.id,
      equipo_anterior_nombre: device.name,
      equipo_anterior_fabricante:
        device.device_type?.manufacturer?.name || "SIN FABRICANTE",
      equipo_anterior_modelo: device.device_type?.model || "SIN MODELO",
      equipo_anterior_serial: device.serial || null,
      equipo_anterior_rack_netbox_id: device.rack?.id || null,
      equipo_anterior_rack_nombre: device.rack?.name || null,
      equipo_anterior_ru_inicio: device.position || null,
      equipo_anterior_cantidad_ru:
        Number(device.device_type?.u_height) || 1,
      cantidad_ru: Number(device.device_type?.u_height) || 1,
    };
  };

  const installationDetail = (item, index, replacement = false) => ({
    numero_item: index + 1,
    grupo_reemplazo: replacement ? index + 1 : null,
    accion: "INSTALACION",
    es_rackeable: item.instalacionRackeable === "SI",
    manufacturer_netbox_id: Number(item.fabricanteId),
    device_type_netbox_id: Number(item.modeloId),
    fabricante: item.fabricante,
    modelo: item.modelo,
    nombre_propuesto: item.nombrePropuesto.trim(),
    cantidad_ru: Number(item.cantidadRu) || 1,
  });

  const enviar = async () => {
    if (!contexto || items.length === 0) {
      setError("Seleccione una cantidad válida");
      return;
    }

    const needsExisting = ["RETIRO", "REEMPLAZO"].includes(
      contexto.tipo_movimiento,
    );
    const needsNew = ["INSTALACION", "REEMPLAZO", "INGRESO_FO"].includes(
      contexto.tipo_movimiento,
    );

    if (needsExisting && items.some((item) => !item.retiro)) {
      setError("Seleccione todos los equipos que serán retirados");
      return;
    }

    if (needsNew && items.some((item) =>
      !item.fabricanteId ||
      !item.modeloId ||
      !item.instalacionRackeable ||
      !item.nombrePropuesto.trim()
    )) {
      setError("Complete fabricante, modelo, condición y nombre de cada equipo");
      return;
    }

    const selectedDevices = items.map((item) => item.retiroId).filter(Boolean);
    if (new Set(selectedDevices).size !== selectedDevices.length) {
      setError("No puede seleccionar el mismo equipo dos veces");
      return;
    }

    const names = items
      .map((item) => item.nombrePropuesto.trim().toLowerCase())
      .filter(Boolean);
    if (new Set(names).size !== names.length) {
      setError("Los nombres propuestos no pueden repetirse");
      return;
    }

    const detalles = [];
    items.forEach((item, index) => {
      if (contexto.tipo_movimiento === "RETIRO") {
        detalles.push(retiroDetail(item, index));
      } else if (contexto.tipo_movimiento === "REEMPLAZO") {
        detalles.push(retiroDetail(item, index, true));
        detalles.push(installationDetail(item, index, true));
      } else {
        detalles.push(installationDetail(item, index));
      }
    });

    try {
      setSending(true);
      setError("");
      const result = await registrarMovimientoEquipos(codigo, detalles);
      setSuccess(
        `Solicitud de equipos ${result.movimiento_id} registrada en estado PENDIENTE`,
      );
      setContexto((current) => ({
        ...current,
        movimiento_id: result.movimiento_id,
        movimiento_estado: result.estado,
      }));
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <h3 style={{ padding: "2rem" }}>Validando solicitud...</h3>;
  }

  if (error && !contexto) {
    return (
      <div className="home-container">
        <div className="home-card">
          <h3>No se pudo abrir Gestión de Equipos</h3>
          <p className="text-danger">{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-card" style={{ maxWidth: "900px" }}>
        <h2>Gestión de Equipos</h2>
        <p><strong>Código:</strong> {codigo}</p>
        <p><strong>Nodo:</strong> {contexto?.nodo}</p>
        <p><strong>Tipo:</strong> {contexto?.tipo_trabajo}</p>
        <p><strong>Solicitante:</strong> {contexto?.solicitante}</p>
        <p><strong>Empresa/contrata:</strong> {contexto?.empresa}</p>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {contexto?.movimiento_id ? (
          <div className="alert alert-info">
            El formulario ya fue registrado. Estado: {contexto.movimiento_estado}
          </div>
        ) : (
          <>
            <div className="form-row">
              <label>Cantidad de items</label>
              <input
                type="number"
                min="1"
                max="50"
                value={cantidad}
                onChange={(event) => cambiarCantidad(event.target.value)}
                className="form-control"
              />
            </div>

            {items.map((item, index) => (
              <div className="equipo-box" key={index}>
                <h5>
                  {contexto?.tipo_movimiento === "REEMPLAZO"
                    ? `Reemplazo ${index + 1}`
                    : `Equipo ${index + 1}`}
                </h5>

                {["RETIRO", "REEMPLAZO"].includes(contexto?.tipo_movimiento) && (
                  <>
                    <h6>Equipo existente</h6>
                    <div className="form-row">
                      <label>Condición</label>
                      <select
                        className="form-control"
                        value={item.retiroTipo}
                        onChange={(event) => updateItem(index, {
                          retiroTipo: event.target.value,
                          retiroId: "",
                          retiro: null,
                        })}
                      >
                        <option value="">Seleccione</option>
                        <option value="RACKEABLE">Rackeable</option>
                        <option value="NO_RACKEABLE">No rackeable</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Equipo</label>
                      <select
                        className="form-control"
                        value={item.retiroId}
                        disabled={!item.retiroTipo}
                        onChange={(event) => seleccionarRetiro(index, event.target.value)}
                      >
                        <option value="">Seleccione</option>
                        {equiposNetbox
                          .filter((device) =>
                            item.retiroTipo === "RACKEABLE"
                              ? Boolean(device.rack)
                              : !device.rack
                          )
                          .map((device) => (
                            <option value={device.id} key={device.id}>
                              {device.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {item.retiro && (
                      <div className="alert alert-secondary">
                        {item.retiro.device_type?.manufacturer?.name} · {item.retiro.device_type?.model}
                        {item.retiro.rack && (
                          <> · Rack {item.retiro.rack.name}, RU {item.retiro.position}</>
                        )}
                      </div>
                    )}
                  </>
                )}

                {["INSTALACION", "REEMPLAZO", "INGRESO_FO"].includes(
                  contexto?.tipo_movimiento,
                ) && (
                  <>
                    <h6>Equipo nuevo</h6>
                    <div className="form-row">
                      <label>Condición</label>
                      <select
                        className="form-control"
                        value={item.instalacionRackeable}
                        onChange={(event) => updateItem(index, {
                          instalacionRackeable: event.target.value,
                        })}
                      >
                        <option value="">Seleccione</option>
                        <option value="SI">Rackeable</option>
                        <option value="NO">No rackeable</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Fabricante</label>
                      <select
                        className="form-control"
                        value={item.fabricanteId}
                        onChange={(event) => seleccionarFabricante(index, event.target.value)}
                      >
                        <option value="">Seleccione</option>
                        {fabricantes.map((manufacturer) => (
                          <option value={manufacturer.id} key={manufacturer.id}>
                            {manufacturer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Modelo</label>
                      <select
                        className="form-control"
                        value={item.modeloId}
                        disabled={!item.fabricanteId}
                        onChange={(event) => seleccionarModelo(index, event.target.value)}
                      >
                        <option value="">Seleccione</option>
                        {item.modelos.map((model) => (
                          <option value={model.id} key={model.id}>
                            {model.model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Nombre propuesto</label>
                      <input
                        className="form-control"
                        value={item.nombrePropuesto}
                        onChange={(event) => updateItem(index, {
                          nombrePropuesto: event.target.value,
                        })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              className="btn btn-success"
              disabled={sending || items.length === 0}
              onClick={enviar}
            >
              {sending ? "Enviando..." : "Enviar solicitud de equipos"}
            </button>
          </>
        )}

        <button
          type="button"
          className="btn btn-secondary ms-2"
          onClick={() => navigate("/")}
        >
          Volver
        </button>
      </div>
    </div>
  );
}

export default Instalaciones;
