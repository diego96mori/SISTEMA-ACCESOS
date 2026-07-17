import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaServer,
  FaTimes,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";
import {
  consultarCatalogoNetboxAdmin,
  denegarMovimientoEquipos,
  procesarMovimientoNetbox,
} from "../services/equipos";

const processableStates = ["PENDIENTE", "EN_REVISION", "ERROR"];

function detailTitle(detail) {
  return detail.accion === "RETIRO"
    ? detail.equipo_anterior_nombre
    : detail.nombre_aprobado || detail.nombre_propuesto;
}

function sortedDetails(movement) {
  const actionOrder = { RETIRO: 0, INSTALACION: 1 };
  return [...(movement.movimiento_detalle || [])].sort(
    (a, b) =>
      a.numero_item - b.numero_item ||
      actionOrder[a.accion] - actionOrder[b.accion],
  );
}

function Equipos() {
  const navigate = useNavigate();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [racks, setRacks] = useState([]);
  const [aprobaciones, setAprobaciones] = useState({});
  const [posiciones, setPosiciones] = useState({});
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCodigo, setFiltroCodigo] = useState("");

  const cargarMovimientos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("movimientos")
      .select(`
        id,
        acceso_id,
        tipo_movimiento,
        cantidad_items,
        estado,
        observacion_admin,
        error_general,
        aprobado_por,
        fecha_aprobacion,
        created_at,
        accesos (
          id,
          codigo_seguimiento,
          fecha_ingreso,
          solicitante_nombre,
          solicitante_ap_paterno,
          nodos ( nombre, netbox_site_id )
        ),
        movimiento_detalle (
          id,
          numero_item,
          grupo_reemplazo,
          accion,
          es_rackeable,
          equipo_anterior_netbox_id,
          equipo_anterior_nombre,
          equipo_anterior_fabricante,
          equipo_anterior_modelo,
          equipo_anterior_serial,
          equipo_anterior_rack_netbox_id,
          equipo_anterior_rack_nombre,
          equipo_anterior_ru_inicio,
          equipo_anterior_cantidad_ru,
          manufacturer_netbox_id,
          device_type_netbox_id,
          device_role_netbox_id,
          device_role_nombre,
          fabricante,
          modelo,
          serial,
          nombre_propuesto,
          nombre_aprobado,
          rack_aprobado_netbox_id,
          rack_aprobado_nombre,
          ru_inicio_aprobada,
          cantidad_ru,
          equipo_resultado_netbox_id,
          estado_ejecucion,
          error_netbox
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMensaje(`No se pudieron cargar los movimientos: ${error.message}`);
      setMovimientos([]);
    } else {
      setMovimientos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((movement) => {
    const matchesStatus = !filtroEstado || movement.estado === filtroEstado;
    const matchesType = !filtroTipo || movement.tipo_movimiento === filtroTipo;
    const code = String(movement.accesos?.codigo_seguimiento || "").toLowerCase();
    return matchesStatus && matchesType && code.includes(filtroCodigo.trim().toLowerCase());
  }), [filtroCodigo, filtroEstado, filtroTipo, movimientos]);

  const updateApproval = (detailId, changes) => {
    setAprobaciones((current) => ({
      ...current,
      [detailId]: { ...current[detailId], ...changes },
    }));
  };

  const withdrawalFor = (movement, detail) =>
    movement.movimiento_detalle?.find(
      (item) => item.numero_item === detail.numero_item && item.accion === "RETIRO",
    );

  const loadPositions = async (movement, detail, rackId) => {
    if (!rackId) {
      setPosiciones((current) => ({ ...current, [detail.id]: [] }));
      return [];
    }
    setPosiciones((current) => ({ ...current, [detail.id]: null }));
    const withdrawal = withdrawalFor(movement, detail);
    const data = await consultarCatalogoNetboxAdmin(
      movement.id,
      "posiciones",
      {
        rack_id: Number(rackId),
        device_type_id: detail.device_type_netbox_id,
        equipo_retiro_id: withdrawal?.equipo_anterior_netbox_id || null,
      },
    );
    setPosiciones((current) => ({ ...current, [detail.id]: data }));
    return data;
  };

  const abrirRevision = async (movement) => {
    setSeleccionado(movement);
    setMensaje("");
    setRoles([]);
    setRacks([]);
    setPosiciones({});

    const installations = movement.movimiento_detalle?.filter(
      (detail) => detail.accion === "INSTALACION",
    ) || [];
    const initialApprovals = {};
    for (const detail of installations) {
      const withdrawal = withdrawalFor(movement, detail);
      const defaultRackId = detail.rack_aprobado_netbox_id ||
        (detail.es_rackeable ? withdrawal?.equipo_anterior_rack_netbox_id : null) || "";
      initialApprovals[detail.id] = {
        detalle_id: detail.id,
        nombre_aprobado: detail.nombre_aprobado || detail.nombre_propuesto || "",
        device_role_netbox_id: detail.device_role_netbox_id || "",
        device_role_nombre: detail.device_role_nombre || "",
        rack_aprobado_netbox_id: defaultRackId,
        rack_aprobado_nombre: detail.rack_aprobado_nombre ||
          (detail.es_rackeable ? withdrawal?.equipo_anterior_rack_nombre : "") || "",
        ru_inicio_aprobada: detail.ru_inicio_aprobada ||
          (detail.es_rackeable ? withdrawal?.equipo_anterior_ru_inicio : null) || "",
      };
    }
    setAprobaciones(initialApprovals);

    if (installations.length === 0 || !processableStates.includes(movement.estado)) return;

    try {
      setCatalogLoading(true);
      const [roleOptions, rackOptions] = await Promise.all([
        consultarCatalogoNetboxAdmin(movement.id, "roles"),
        consultarCatalogoNetboxAdmin(movement.id, "racks"),
      ]);
      setRoles(roleOptions);
      setRacks(rackOptions);

      await Promise.all(installations.map(async (detail) => {
        const rackId = initialApprovals[detail.id].rack_aprobado_netbox_id;
        if (!detail.es_rackeable || !rackId) return;
        const available = await loadPositions(movement, detail, rackId);
        const selectedPosition = Number(initialApprovals[detail.id].ru_inicio_aprobada);
        if (!available.some((item) => item.position === selectedPosition)) {
          updateApproval(detail.id, { ru_inicio_aprobada: "" });
        }
      }));
    } catch (error) {
      console.error(error);
      setMensaje(error.message);
    } finally {
      setCatalogLoading(false);
    }
  };

  const changeRole = (detailId, roleId) => {
    const role = roles.find((item) => item.id === Number(roleId));
    updateApproval(detailId, {
      device_role_netbox_id: roleId,
      device_role_nombre: role?.name || "",
    });
  };

  const changeRack = async (movement, detail, rackId) => {
    const rack = racks.find((item) => item.id === Number(rackId));
    updateApproval(detail.id, {
      rack_aprobado_netbox_id: rackId,
      rack_aprobado_nombre: rack?.name || "",
      ru_inicio_aprobada: "",
    });
    try {
      await loadPositions(movement, detail, rackId);
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const denegar = async (movement) => {
    const reason = window.prompt("Indique el motivo de la denegacion:");
    if (!reason?.trim()) return;
    try {
      setProcesandoId(movement.id);
      await denegarMovimientoEquipos(movement.id, reason);
      setMensaje("Solicitud de equipos denegada correctamente");
      setSeleccionado(null);
      await cargarMovimientos();
    } catch (error) {
      console.error(error);
      setMensaje(error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const proceder = async (movement) => {
    const installations = movement.movimiento_detalle?.filter(
      (detail) => detail.accion === "INSTALACION",
    ) || [];
    const payload = installations.map((detail) => {
      const approval = aprobaciones[detail.id] || {};
      return {
        detalle_id: detail.id,
        nombre_aprobado: String(approval.nombre_aprobado || "").trim(),
        device_role_netbox_id: Number(approval.device_role_netbox_id) || null,
        device_role_nombre: approval.device_role_nombre || null,
        rack_aprobado_netbox_id: detail.es_rackeable
          ? Number(approval.rack_aprobado_netbox_id) || null
          : null,
        rack_aprobado_nombre: detail.es_rackeable
          ? approval.rack_aprobado_nombre || null
          : null,
        ru_inicio_aprobada: detail.es_rackeable
          ? Number(approval.ru_inicio_aprobada) || null
          : null,
      };
    });

    const invalid = installations.some((detail) => {
      const approval = aprobaciones[detail.id] || {};
      return !String(approval.nombre_aprobado || "").trim() ||
        !approval.device_role_netbox_id ||
        (detail.es_rackeable &&
          (!approval.rack_aprobado_netbox_id || !approval.ru_inicio_aprobada));
    });
    if (invalid) {
      setMensaje("Complete nombre, rol y, cuando corresponda, rack y RU");
      return;
    }

    const names = payload.map((item) => item.nombre_aprobado.toLowerCase());
    if (new Set(names).size !== names.length) {
      setMensaje("Los nombres aprobados no pueden repetirse");
      return;
    }

    if (!window.confirm("Se aplicaran los cambios en NetBox. Desea continuar?")) return;
    try {
      setProcesandoId(movement.id);
      setMensaje("Procesando y validando NetBox...");
      const result = await procesarMovimientoNetbox(movement.id, payload);
      setMensaje(`Movimiento ${result.movimiento_id} aprobado y sincronizado con NetBox`);
      setSeleccionado(null);
      await cargarMovimientos();
    } catch (error) {
      console.error(error);
      setMensaje(error.message);
      await cargarMovimientos();
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">WI-NET</h2>
        <button onClick={() => navigate("/dashboard")} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200">
          Lista de Accesos
        </button>
        <button className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white mt-2">
          Gestion Equipos
        </button>
        <button onClick={() => navigate("/racks")} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-200 mt-2">
          Vista de Racks
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-hidden">
        <h1 className="text-2xl font-semibold mb-6">Gestion de Equipos</h1>
        {mensaje && <div className="mb-4 p-3 bg-blue-100 text-blue-900 rounded">{mensaje}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input className="border rounded p-2" placeholder="Buscar codigo" value={filtroCodigo} onChange={(event) => setFiltroCodigo(event.target.value)} />
          <select className="border rounded p-2" value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            {["PENDIENTE", "EN_REVISION", "PROCESANDO", "APROBADO", "DENEGADO", "ERROR"].map((status) => <option key={status}>{status}</option>)}
          </select>
          <select className="border rounded p-2" value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
            <option value="">Todos los tipos</option>
            {["INSTALACION", "RETIRO", "REEMPLAZO", "INGRESO_FO"].map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {loading ? <p className="p-6">Cargando...</p> : (
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Movimiento</th><th className="p-4">Codigo</th><th className="p-4">Nodo</th>
                  <th className="p-4">Solicitante</th><th className="p-4">Tipo</th><th className="p-4">Items</th>
                  <th className="p-4">Fecha</th><th className="p-4">Estado</th><th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((movement) => (
                  <tr key={movement.id} className="border-b hover:bg-blue-50">
                    <td className="p-4">{movement.id}</td>
                    <td className="p-4 max-w-48 truncate" title={movement.accesos?.codigo_seguimiento}>{movement.accesos?.codigo_seguimiento}</td>
                    <td className="p-4">{movement.accesos?.nodos?.nombre}</td>
                    <td className="p-4">{movement.accesos?.solicitante_nombre} {movement.accesos?.solicitante_ap_paterno}</td>
                    <td className="p-4 font-semibold">{movement.tipo_movimiento}</td>
                    <td className="p-4">{movement.cantidad_items}</td>
                    <td className="p-4">{movement.accesos?.fecha_ingreso}</td>
                    <td className="p-4"><strong>{movement.estado}</strong>{movement.error_general && <div className="text-xs text-red-600 max-w-64 whitespace-normal">{movement.error_general}</div>}</td>
                    <td className="p-4"><div className="flex gap-2">
                      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={() => abrirRevision(movement)}>Revisar</button>
                      <button className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-40" disabled={!['PENDIENTE', 'EN_REVISION'].includes(movement.estado) || procesandoId === movement.id} onClick={() => denegar(movement)}>Denegar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {seleccionado && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-50 border border-white/20 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-auto shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-5 px-6 py-5 border-b border-stone-200 bg-stone-100/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-stone-800 text-white"><FaServer /></span>
                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-amber-800">Revisión de solicitud</p>
                  <h2 className="text-xl font-bold text-slate-900">Movimiento {seleccionado.id} · {seleccionado.tipo_movimiento}</h2>
                </div>
              </div>
              <button type="button" aria-label="Cerrar revisión" onClick={() => setSeleccionado(null)} className="grid place-items-center w-9 h-9 rounded-lg text-slate-600 bg-stone-200 hover:bg-stone-300"><FaTimes /></button>
            </header>

            <div className="p-6">
              <section className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 mb-5">
                <div className="bg-white p-4 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Código de seguimiento</span>
                  <strong className="font-mono text-sm text-slate-800 break-all">{seleccionado.accesos?.codigo_seguimiento}</strong>
                </div>
                <div className="bg-white p-4">
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"><FaMapMarkerAlt /> Nodo</span>
                  <strong className="text-sm text-slate-800">{seleccionado.accesos?.nodos?.nombre}</strong>
                </div>
                <div className="bg-white p-4">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Solicitante</span>
                  <strong className="text-sm text-slate-800">{seleccionado.accesos?.solicitante_nombre} {seleccionado.accesos?.solicitante_ap_paterno}</strong>
                </div>
                <div className="bg-white p-4">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cantidad</span>
                  <strong className="text-sm text-slate-800">{seleccionado.cantidad_items} {seleccionado.cantidad_items === 1 ? "ítem" : "ítems"}</strong>
                </div>
                <div className="bg-white p-4">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Estado</span>
                  <strong className="text-sm text-slate-800">{seleccionado.estado}</strong>
                </div>
              </section>

              {catalogLoading && <p className="p-3 border border-amber-200 bg-amber-50 text-amber-900 rounded-xl mb-4 text-sm">Consultando roles, racks y posiciones disponibles...</p>}

              <div className="space-y-4">
              {sortedDetails(seleccionado).map((detail) => {
                const approval = aprobaciones[detail.id] || {};
                const available = posiciones[detail.id];
                return (
                  <article key={detail.id} className="overflow-hidden border border-stone-200 rounded-xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-stone-100">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-9 h-9 rounded-lg bg-amber-100 text-amber-800"><FaBoxOpen /></span>
                        <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ítem {detail.numero_item}</p><h3 className="font-bold text-slate-900">{detailTitle(detail)}</h3></div>
                      </div>
                      <div className="flex gap-2"><span className="px-2.5 py-1 rounded-full bg-stone-200 text-[11px] font-bold text-slate-700">{detail.accion}</span><span className="px-2.5 py-1 rounded-full bg-stone-200 text-[11px] font-bold text-slate-700">{detail.es_rackeable ? "Rackeable" : "No rackeable"}</span></div>
                    </div>
                    {detail.accion === "RETIRO" ? (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-5">
                        <div className="p-3 rounded-lg bg-stone-50"><dt className="text-[11px] font-bold uppercase text-slate-500">NetBox ID</dt><dd className="mt-1 font-semibold text-sm">{detail.equipo_anterior_netbox_id}</dd></div>
                        <div className="p-3 rounded-lg bg-stone-50"><dt className="text-[11px] font-bold uppercase text-slate-500">Fabricante / modelo</dt><dd className="mt-1 font-semibold text-sm">{detail.equipo_anterior_fabricante} / {detail.equipo_anterior_modelo}</dd></div>
                        <div className="p-3 rounded-lg bg-stone-50"><dt className="text-[11px] font-bold uppercase text-slate-500">Rack</dt><dd className="mt-1 font-semibold text-sm">{detail.equipo_anterior_rack_nombre || "No aplica"}</dd></div>
                        <div className="p-3 rounded-lg bg-stone-50"><dt className="text-[11px] font-bold uppercase text-slate-500">RU</dt><dd className="mt-1 font-semibold text-sm">{detail.equipo_anterior_ru_inicio || "No aplica"}</dd></div>
                      </dl>
                    ) : (
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-xs font-bold text-slate-600">Fabricante<input className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full bg-stone-100 font-normal" value={detail.fabricante || ""} disabled /></label>
                        <label className="text-xs font-bold text-slate-600">Modelo<input className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full bg-stone-100 font-normal" value={detail.modelo || ""} disabled /></label>
                        <label className="text-xs font-bold text-slate-600">Nombre aprobado<input className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full font-normal disabled:bg-stone-100" value={approval.nombre_aprobado || ""} disabled={!processableStates.includes(seleccionado.estado)} onChange={(event) => updateApproval(detail.id, { nombre_aprobado: event.target.value })} /></label>
                        <label className="text-xs font-bold text-slate-600">Rol de dispositivo<select className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full font-normal disabled:bg-stone-100" value={approval.device_role_netbox_id || ""} disabled={!processableStates.includes(seleccionado.estado)} onChange={(event) => changeRole(detail.id, event.target.value)}><option value="">Seleccione</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                        {detail.es_rackeable && <>
                          <label className="text-xs font-bold text-slate-600">Rack<select className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full font-normal disabled:bg-stone-100" value={approval.rack_aprobado_netbox_id || ""} disabled={!processableStates.includes(seleccionado.estado)} onChange={(event) => changeRack(seleccionado, detail, event.target.value)}><option value="">Seleccione</option>{racks.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}</select></label>
                          <label className="text-xs font-bold text-slate-600">RU disponible<select className="mt-1.5 border border-stone-300 rounded-lg p-2.5 w-full font-normal disabled:bg-stone-100" value={approval.ru_inicio_aprobada || ""} disabled={!processableStates.includes(seleccionado.estado) || available === null} onChange={(event) => updateApproval(detail.id, { ru_inicio_aprobada: event.target.value })}><option value="">{available === null ? "Consultando..." : "Seleccione"}</option>{(available || []).map((position) => <option key={position.position} value={position.position}>{position.label}</option>)}</select></label>
                        </>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-stone-200 text-xs text-slate-600"><FaCheckCircle className={detail.estado_ejecucion === "EJECUTADO" ? "text-emerald-600" : "text-stone-400"} /><strong>Ejecución:</strong> {detail.estado_ejecucion}</div>
                    {detail.error_netbox && <p className="px-5 pb-4 text-sm text-red-600">{detail.error_netbox}</p>}
                  </article>
                );
              })}
              </div>

              <footer className="mt-6 pt-5 border-t border-stone-200 flex flex-wrap justify-between gap-3">
              <button className="bg-stone-600 hover:bg-stone-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm" onClick={() => setSeleccionado(null)}>Cerrar</button>
              <div className="flex gap-2">
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40" disabled={!['PENDIENTE', 'EN_REVISION'].includes(seleccionado.estado) || procesandoId === seleccionado.id} onClick={() => denegar(seleccionado)}>Denegar</button>
                <button className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40" disabled={!processableStates.includes(seleccionado.estado) || catalogLoading || procesandoId === seleccionado.id} onClick={() => proceder(seleccionado)}>{procesandoId === seleccionado.id ? "Procesando..." : "Aprobar en NetBox"}</button>
              </div>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipos;
