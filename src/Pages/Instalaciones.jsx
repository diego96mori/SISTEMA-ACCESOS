import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardList,
  FaMapMarkerAlt,
  FaServer,
} from "react-icons/fa";
import {
  consultarCatalogoNetbox,
  obtenerContextoEquipos,
  obtenerResumenMovimientoEquipos,
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

const movementStatusMessages = {
  PENDIENTE: "Solicitud pendiente",
  EN_REVISION: "Solicitud en revisión",
  PROCESANDO: "Solicitud procesándose en NetBox",
  APROBADO: "Solicitud aprobada",
  DENEGADO: "Solicitud denegada",
  ERROR: "La solicitud requiere revisión",
};

function Instalaciones() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [contexto, setContexto] = useState(null);
  const [resumenMovimiento, setResumenMovimiento] = useState(null);
  const [equiposNetbox, setEquiposNetbox] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [cantidad, setCantidad] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const context = await obtenerContextoEquipos(codigo);
      setContexto(context);

      if (context.movimiento_id) {
        const summary = await obtenerResumenMovimientoEquipos(codigo);
        setResumenMovimiento(summary);
        return;
      }

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
      setResumenMovimiento({
        movimiento_id: result.movimiento_id,
        estado: result.estado,
        detalles: [],
      });
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
    return (
      <div className="equipment-public-page equipment-public-center">
        <div className="equipment-loader" aria-label="Validando solicitud" />
        <p>Validando solicitud...</p>
      </div>
    );
  }

  if (error && !contexto) {
    return (
      <div className="equipment-public-page equipment-public-center">
        <div className="equipment-error-card">
          <FaBoxOpen aria-hidden="true" />
          <h2>No se pudo abrir Gestión de Equipos</h2>
          <p>{error}</p>
          <button type="button" onClick={() => navigate("/")}>
            <FaArrowLeft aria-hidden="true" /> Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="equipment-public-page">
      <main className="equipment-public-shell">
        <header className="equipment-public-header">
          <div className="equipment-public-title">
            <span><FaServer aria-hidden="true" /></span>
            <div>
              <p>Formulario complementario</p>
              <h1>Gestión de Equipos</h1>
            </div>
          </div>
          <span className={`equipment-status equipment-status-${String(resumenMovimiento?.estado || "NUEVO").toLowerCase()}`}>
            {resumenMovimiento?.estado || "NUEVO"}
          </span>
        </header>

        <section className="equipment-context-card" aria-label="Datos de la solicitud">
          <div className="equipment-context-code">
            <span>Código</span>
            <strong>{codigo}</strong>
          </div>
          <div className="equipment-context-grid">
            <div><span><FaMapMarkerAlt /> Nodo</span><strong>{contexto?.nodo}</strong></div>
            <div><span><FaClipboardList /> Tipo</span><strong>{contexto?.tipo_trabajo}</strong></div>
            <div><span>Solicitante</span><strong>{contexto?.solicitante}</strong></div>
            <div><span>Empresa/contrata</span><strong>{contexto?.empresa}</strong></div>
          </div>
        </section>

        {error && <div className="equipment-message equipment-message-error" role="alert">{error}</div>}

        {contexto?.movimiento_id ? (
          <section className="equipment-result-section">
            {(resumenMovimiento?.detalles ?? []).length > 0 && (
              <div className="equipment-approved-list">
                {(resumenMovimiento.detalles ?? []).map((detalle) => (
                  <article className="equipment-approved-card" key={detalle.id}>
                    <div>
                      <span>Item {detalle.numero_item} · {detalle.accion}</span>
                      <h3>{detalle.equipo || "Equipo sin nombre"}</h3>
                    </div>
                    <dl>
                      <div><dt>Rack</dt><dd>{detalle.rack || "No aplica"}</dd></div>
                      <div><dt>RU</dt><dd>{detalle.ru ?? "No aplica"}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
            <div className={`equipment-message ${resumenMovimiento?.estado === "APROBADO" ? "equipment-message-success" : "equipment-message-pending"}`} role="status">
              {resumenMovimiento?.estado === "APROBADO" ? (
                <><FaCheckCircle aria-hidden="true" /> Solicitud aprobada</>
              ) : (
                <>{movementStatusMessages[resumenMovimiento?.estado || contexto.movimiento_estado] || `Estado: ${resumenMovimiento?.estado || contexto.movimiento_estado}`}</>
              )}
            </div>
          </section>
        ) : (
          <section className="equipment-form-section">
            <div className="equipment-quantity-row">
              <div>
                <h2>Equipos involucrados</h2>
                <p>Indica la cantidad y completa la información de cada equipo.</p>
              </div>
              <label>
                Cantidad de ítems
                <input type="number" min="1" max="50" value={cantidad} onChange={(event) => cambiarCantidad(event.target.value)} />
              </label>
            </div>

            <div className="equipment-items-list">
              {items.map((item, index) => (
                <article className="equipment-item-card" key={index}>
                  <div className="equipment-item-heading">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p>{contexto?.tipo_movimiento === "REEMPLAZO" ? "Reemplazo" : "Equipo"}</p>
                      <h3>Ítem {index + 1} de {items.length}</h3>
                    </div>
                  </div>

                  {["RETIRO", "REEMPLAZO"].includes(contexto?.tipo_movimiento) && (
                    <div className="equipment-subsection">
                      <h4>Equipo que se retirará</h4>
                      <div className="equipment-field-grid">
                        <label>Condición<select value={item.retiroTipo} onChange={(event) => updateItem(index, { retiroTipo: event.target.value, retiroId: "", retiro: null })}><option value="">Seleccionar</option><option value="RACKEABLE">Rackeable</option><option value="NO_RACKEABLE">No rackeable</option></select></label>
                        <label>Equipo<select value={item.retiroId} disabled={!item.retiroTipo} onChange={(event) => seleccionarRetiro(index, event.target.value)}><option value="">Seleccionar equipo</option>{equiposNetbox.filter((device) => item.retiroTipo === "RACKEABLE" ? Boolean(device.rack) : !device.rack).map((device) => <option value={device.id} key={device.id}>{device.name}</option>)}</select></label>
                      </div>
                      {item.retiro && (
                        <dl className="equipment-location-summary">
                          <div><dt>Rack</dt><dd>{item.retiro.rack?.name || "No aplica"}</dd></div>
                          <div><dt>RU</dt><dd>{item.retiro.position ?? "No aplica"}</dd></div>
                        </dl>
                      )}
                    </div>
                  )}

                  {["INSTALACION", "REEMPLAZO", "INGRESO_FO"].includes(contexto?.tipo_movimiento) && (
                    <div className="equipment-subsection">
                      <h4>Equipo nuevo</h4>
                      <div className="equipment-field-grid">
                        <label>Condición<select value={item.instalacionRackeable} onChange={(event) => updateItem(index, { instalacionRackeable: event.target.value })}><option value="">Seleccionar</option><option value="SI">Rackeable</option><option value="NO">No rackeable</option></select></label>
                        <label>Fabricante<select value={item.fabricanteId} onChange={(event) => seleccionarFabricante(index, event.target.value)}><option value="">Seleccionar</option>{fabricantes.map((manufacturer) => <option value={manufacturer.id} key={manufacturer.id}>{manufacturer.name}</option>)}</select></label>
                        <label>Modelo<select value={item.modeloId} disabled={!item.fabricanteId} onChange={(event) => seleccionarModelo(index, event.target.value)}><option value="">Seleccionar</option>{item.modelos.map((model) => <option value={model.id} key={model.id}>{model.model}</option>)}</select></label>
                        <label>Nombre propuesto<input value={item.nombrePropuesto} onChange={(event) => updateItem(index, { nombrePropuesto: event.target.value })} /></label>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="equipment-public-actions">
              <button type="button" className="equipment-btn equipment-btn-secondary" onClick={() => navigate("/")}><FaArrowLeft /> Volver</button>
              <button type="button" className="equipment-btn equipment-btn-primary" disabled={sending || items.length === 0} onClick={enviar}>{sending ? "Enviando..." : "Enviar solicitud"}</button>
            </div>
          </section>
        )}

        {contexto?.movimiento_id && (
          <div className="equipment-public-actions equipment-public-actions-single">
            <button type="button" className="equipment-btn equipment-btn-secondary" onClick={() => navigate("/")}><FaArrowLeft /> Volver al inicio</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default Instalaciones;
