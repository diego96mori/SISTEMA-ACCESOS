import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaBuilding,
  FaCalendarAlt,
  FaCheckCircle,
  FaFilePdf,
  FaIdCard,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import {
  cargarCatalogosPublicos,
  registrarSolicitudAcceso,
} from "../services/accesos";
import "./Acceso.css";

const EMPTY_PERSON = {
  nombre: "",
  ap_paterno: "",
  ap_materno: "",
  tipo_doc_id: "",
  num_doc: "",
  telefono: "",
};

const NAME_PATTERN = /^[A-ZÁÉÍÓÚÜÑ ]+$/;
const PHONE_PATTERN = /^9\d{8}$/;
const DOCUMENT_PATTERN = /^\d{8}$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function inputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDayLabel(value) {
  if (!value) return "el día siguiente";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return new Intl.DateTimeFormat("es-PE").format(date);
}

function sanitizeName(value) {
  return value
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "")
    .replace(/\s{2,}/g, " ")
    .toUpperCase();
}

function onlyDigits(value, maxLength) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function SectionTitle({ icon, title, description }) {
  return (
    <div className="access-section-heading">
      <span className="access-section-icon" aria-hidden="true">{icon}</span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function Acceso() {
  const navigate = useNavigate();
  const today = useMemo(() => inputDate(), []);
  const [form, setForm] = useState({
    nodo_id: "",
    fecha_ingreso: "",
    fecha_salida: "",
    hora_ingreso: "",
    hora_salida: "",
    solicitante_nombre: "",
    solicitante_ap_paterno: "",
    solicitante_ap_materno: "",
    solicitante_telefono: "",
    solicitante_tipo_doc_id: "",
    solicitante_num_doc: "",
    solicitante_correo: "",
    nivel_acceso_id: "",
    empresa_id: "",
    area_responsable_id: "",
    area_apoyo_id: "",
    tipo_trabajo_id: "",
    detalle_trabajo: "",
    trabajo_contrata: "",
    nombre_contrata: "",
    numero_personal: 1,
  });
  const [correoUser, setCorreoUser] = useState("");
  const [correoDominio, setCorreoDominio] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [personal, setPersonal] = useState([{ ...EMPTY_PERSON }]);
  const [copiarSolicitante, setCopiarSolicitante] = useState(false);
  const [formError, setFormError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [nuevoId, setNuevoId] = useState(null);
  const [formulariosSiguientes, setFormulariosSiguientes] = useState([]);
  const [nodos, setNodos] = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tiposTrabajo, setTiposTrabajo] = useState([]);

  useEffect(() => {
    let active = true;
    const cargarCatalogos = async () => {
      try {
        const catalogos = await cargarCatalogosPublicos();
        if (!active) return;
        setNodos(catalogos.nodos);
        setTiposDoc(catalogos.tiposDoc);
        setNiveles(catalogos.niveles);
        setEmpresas(catalogos.empresas);
        setAreas(catalogos.areas);
        setTiposTrabajo(catalogos.tiposTrabajo);
      } catch (error) {
        console.error(error);
        setFormError(error.message);
      }
    };
    cargarCatalogos();
    return () => { active = false; };
  }, []);

  const areasEmpresa = useMemo(
    () => areas.filter((area) => String(area.empresa_id) === String(form.empresa_id)),
    [areas, form.empresa_id],
  );

  const dateTimeError = useMemo(() => {
    if (form.fecha_ingreso && form.fecha_salida) {
      if (form.fecha_salida < form.fecha_ingreso) {
        return "La fecha de salida debe ser igual o posterior a la fecha de ingreso.";
      }
      if (
        form.fecha_salida === form.fecha_ingreso &&
        form.hora_ingreso &&
        form.hora_salida &&
        form.hora_salida <= form.hora_ingreso
      ) {
        return `La hora de salida corresponde al día siguiente. Cambia la fecha de salida a ${nextDayLabel(form.fecha_ingreso)}.`;
      }
    }
    return "";
  }, [form.fecha_ingreso, form.fecha_salida, form.hora_ingreso, form.hora_salida]);

  useEffect(() => {
    if (!copiarSolicitante) return;
    const solicitante = {
      nombre: form.solicitante_nombre,
      ap_paterno: form.solicitante_ap_paterno,
      ap_materno: form.solicitante_ap_materno,
      tipo_doc_id: form.solicitante_tipo_doc_id,
      num_doc: form.solicitante_num_doc,
      telefono: form.solicitante_telefono,
    };
    setPersonal((current) => {
      const first = current[0] || EMPTY_PERSON;
      const unchanged = Object.keys(solicitante).every(
        (key) => first[key] === solicitante[key],
      );
      if (unchanged) return current;
      const copy = [...current];
      copy[0] = solicitante;
      return copy;
    });
  }, [
    copiarSolicitante,
    form.solicitante_nombre,
    form.solicitante_ap_paterno,
    form.solicitante_ap_materno,
    form.solicitante_tipo_doc_id,
    form.solicitante_num_doc,
    form.solicitante_telefono,
  ]);

  const updateEmail = (user, domain) => {
    setForm((current) => ({
      ...current,
      solicitante_correo: user && domain ? `${user}${domain}` : "",
    }));
  };

  const resizePersonal = (amount) => {
    const quantity = Math.min(8, Math.max(1, Number(amount) || 1));
    setForm((current) => ({ ...current, numero_personal: quantity }));
    setPersonal((current) =>
      Array.from({ length: quantity }, (_, index) => current[index] || { ...EMPTY_PERSON }),
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormError("");

    if (name === "numero_personal") {
      resizePersonal(value);
      return;
    }
    if (name === "empresa_id") {
      setForm((current) => ({
        ...current,
        empresa_id: value,
        area_responsable_id: "",
        area_apoyo_id: "",
      }));
      return;
    }
    if (["solicitante_nombre", "solicitante_ap_paterno", "solicitante_ap_materno"].includes(name)) {
      setForm((current) => ({ ...current, [name]: sanitizeName(value) }));
      return;
    }
    if (name === "solicitante_telefono") {
      setForm((current) => ({ ...current, [name]: onlyDigits(value, 9) }));
      return;
    }
    if (name === "solicitante_num_doc") {
      setForm((current) => ({ ...current, [name]: onlyDigits(value, 8) }));
      return;
    }
    if (name === "detalle_trabajo") {
      setForm((current) => ({ ...current, [name]: value.slice(0, 400) }));
      return;
    }
    if (name === "trabajo_contrata") {
      setForm((current) => ({
        ...current,
        trabajo_contrata: value,
        nombre_contrata: value === "SI" ? current.nombre_contrata : "",
      }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePersonalChange = (index, event) => {
    const { name, value } = event.target;
    if (copiarSolicitante && index === 0) return;
    let nextValue = value;
    if (["nombre", "ap_paterno", "ap_materno"].includes(name)) {
      nextValue = sanitizeName(value);
    } else if (name === "num_doc") {
      nextValue = onlyDigits(value, 8);
    } else if (name === "telefono") {
      nextValue = onlyDigits(value, 9);
    }
    setPersonal((current) => {
      const copy = current.map((person) => ({ ...person }));
      copy[index][name] = nextValue;
      return copy;
    });
  };

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    const combined = [...archivos, ...selected];
    if (combined.length > 3) {
      setFormError("Solo puedes adjuntar hasta 3 archivos PDF.");
      return;
    }
    if (combined.some((file) => file.type !== "application/pdf")) {
      setFormError("Todos los documentos SCTR deben estar en formato PDF.");
      return;
    }
    if (combined.some((file) => file.size > MAX_FILE_SIZE)) {
      setFormError("Cada archivo PDF debe pesar como máximo 10 MiB.");
      return;
    }
    setFormError("");
    setArchivos(combined);
  };

  const validateForm = () => {
    if (dateTimeError) return dateTimeError;
    if (form.fecha_ingreso < today) return "La fecha de ingreso no puede estar en el pasado.";
    const applicantNames = [
      form.solicitante_nombre,
      form.solicitante_ap_paterno,
      form.solicitante_ap_materno,
    ];
    if (applicantNames.some((value) => !NAME_PATTERN.test(value.trim()))) {
      return "Los nombres y apellidos del solicitante solo deben contener letras.";
    }
    if (!PHONE_PATTERN.test(form.solicitante_telefono)) {
      return "El teléfono del solicitante debe tener 9 dígitos y comenzar con 9.";
    }
    if (!DOCUMENT_PATTERN.test(form.solicitante_num_doc)) {
      return "El documento del solicitante debe contener exactamente 8 números.";
    }
    if (!correoUser || !correoDominio || /[@\s]/.test(correoUser)) {
      return "Completa un usuario de correo sin @ ni espacios y selecciona su dominio.";
    }
    if (form.trabajo_contrata === "SI" && !form.nombre_contrata.trim()) {
      return "Ingresa el nombre de la empresa contratista.";
    }
    if (form.detalle_trabajo.length > 400) {
      return "El detalle del trabajo no puede superar 400 caracteres.";
    }
    if (archivos.length < 1 || archivos.length > 3) {
      return "Debes adjuntar entre 1 y 3 documentos SCTR en PDF.";
    }
    for (let index = 0; index < personal.length; index += 1) {
      const person = personal[index];
      if (![person.nombre, person.ap_paterno, person.ap_materno].every((value) => NAME_PATTERN.test(value.trim()))) {
        return `Los nombres y apellidos del Personal ${index + 1} solo deben contener letras.`;
      }
      if (!DOCUMENT_PATTERN.test(person.num_doc)) {
        return `El documento del Personal ${index + 1} debe tener exactamente 8 números.`;
      }
      if (!PHONE_PATTERN.test(person.telefono)) {
        return `El teléfono del Personal ${index + 1} debe tener 9 dígitos y comenzar con 9.`;
      }
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    try {
      setSending(true);
      setShowModal(true);
      setFormError("");
      const result = await registrarSolicitudAcceso({
        acceso: {
          ...form,
          trabajo_contrata: form.trabajo_contrata === "SI",
          nombre_contrata:
            form.trabajo_contrata === "SI" ? form.nombre_contrata : null,
        },
        personal,
        archivos,
      });
      setNuevoId(result.codigo_seguimiento);
      setFormulariosSiguientes(
        result.requiere_equipos ? ["Gestión de equipos"] : [],
      );
    } catch (error) {
      console.error(error);
      setShowModal(false);
      setFormError(error.message || "No se pudo enviar la solicitud.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="access-page">
      <header className="access-topbar">
        <button type="button" className="access-back-link" onClick={() => navigate("/")}>
          <FaArrowLeft aria-hidden="true" /> Volver al inicio
        </button>
        <div className="access-brand">
          <span>WI-NET</span>
          <strong>Solicitud de acceso a nodos</strong>
        </div>
        <span className="access-step">Formulario único</span>
      </header>

      <main className="access-form-shell">
        <div className="access-form-intro">
          <div>
            <p className="access-eyebrow">Nueva solicitud</p>
            <h1>Acceso a nodos</h1>
            <p>Completa la información requerida. Los campos con * son obligatorios.</p>
          </div>
          <div className="access-secure-badge">
            <FaCheckCircle aria-hidden="true" /> Información protegida
          </div>
        </div>

        {formError && <div className="access-alert" role="alert">{formError}</div>}

        <form className="access-form" onSubmit={handleSubmit}>
          <section className="access-section">
            <SectionTitle
              icon={<FaMapMarkerAlt />}
              title="Nodo a ingresar"
              description="Selecciona el nodo sincronizado con NetBox y define el periodo de acceso."
            />
            <div className="access-grid access-grid-3">
              <label className="access-field">
                <span>Nodo *</span>
                <select name="nodo_id" value={form.nodo_id} onChange={handleChange} required>
                  <option value="">Seleccionar nodo</option>
                  {nodos.map((node) => <option key={node.id} value={node.id}>{node.nombre}</option>)}
                </select>
                <small>{nodos.length} nodos disponibles desde NetBox</small>
              </label>
              <label className="access-field">
                <span>Fecha de ingreso *</span>
                <input type="date" name="fecha_ingreso" min={today} value={form.fecha_ingreso} onChange={handleChange} required />
              </label>
              <label className="access-field">
                <span>Fecha de salida *</span>
                <input type="date" name="fecha_salida" min={form.fecha_ingreso || today} value={form.fecha_salida} onChange={handleChange} required />
              </label>
              <label className="access-field">
                <span>Hora de ingreso *</span>
                <input type="time" name="hora_ingreso" value={form.hora_ingreso} onChange={handleChange} required />
              </label>
              <label className="access-field">
                <span>Hora de salida *</span>
                <input type="time" name="hora_salida" value={form.hora_salida} onChange={handleChange} required />
              </label>
            </div>
            {dateTimeError && <p className="access-inline-error"><FaCalendarAlt /> {dateTimeError}</p>}
          </section>

          <section className="access-section">
            <SectionTitle icon={<FaIdCard />} title="Solicitante encargado" description="Datos de la persona responsable de la solicitud." />
            <div className="access-grid access-grid-4">
              <label className="access-field">
                <span>Nombres *</span>
                <input name="solicitante_nombre" value={form.solicitante_nombre} onChange={handleChange} placeholder="NOMBRES" autoComplete="given-name" required />
              </label>
              <label className="access-field">
                <span>Apellido paterno *</span>
                <input name="solicitante_ap_paterno" value={form.solicitante_ap_paterno} onChange={handleChange} placeholder="APELLIDO PATERNO" autoComplete="family-name" required />
              </label>
              <label className="access-field">
                <span>Apellido materno *</span>
                <input name="solicitante_ap_materno" value={form.solicitante_ap_materno} onChange={handleChange} placeholder="APELLIDO MATERNO" required />
              </label>
              <label className="access-field">
                <span>Teléfono *</span>
                <input name="solicitante_telefono" value={form.solicitante_telefono} onChange={handleChange} inputMode="numeric" pattern="9[0-9]{8}" maxLength="9" placeholder="9XXXXXXXX" autoComplete="tel" required />
                <small>9 dígitos; debe comenzar con 9</small>
              </label>
              <label className="access-field">
                <span>Tipo de documento *</span>
                <select name="solicitante_tipo_doc_id" value={form.solicitante_tipo_doc_id} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  {tiposDoc.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}
                </select>
              </label>
              <label className="access-field">
                <span>N.º de documento *</span>
                <input name="solicitante_num_doc" value={form.solicitante_num_doc} onChange={handleChange} inputMode="numeric" pattern="[0-9]{8}" maxLength="8" placeholder="8 DÍGITOS" required />
              </label>
              <div className="access-field access-email-field">
                <span>Correo corporativo *</span>
                <div className="access-email-group">
                  <input
                    value={correoUser}
                    onChange={(event) => {
                      const user = event.target.value.replace(/[@\s]/g, "");
                      setCorreoUser(user);
                      updateEmail(user, correoDominio);
                    }}
                    placeholder="USUARIO"
                    aria-label="Usuario de correo"
                    required
                  />
                  <select
                    value={correoDominio}
                    onChange={(event) => {
                      setCorreoDominio(event.target.value);
                      updateEmail(correoUser, event.target.value);
                    }}
                    aria-label="Dominio de correo"
                    required
                  >
                    <option value="">Dominio</option>
                    <option value="@win.pe">@win.pe</option>
                    <option value="@on.pe">@on.pe</option>
                  </select>
                </div>
                <small>El usuario no admite @ ni espacios</small>
              </div>
            </div>
          </section>

          <section className="access-section">
            <SectionTitle icon={<FaBuilding />} title="Trabajo a realizar" description="Selecciona la empresa para cargar sus áreas correspondientes." />
            <div className="access-grid access-grid-4">
              <label className="access-field">
                <span>Nivel de acceso *</span>
                <select name="nivel_acceso_id" value={form.nivel_acceso_id} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  {niveles.map((level) => <option key={level.id} value={level.id}>{level.nombre}</option>)}
                </select>
              </label>
              <label className="access-field">
                <span>Empresa *</span>
                <select name="empresa_id" value={form.empresa_id} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  {empresas.map((company) => <option key={company.id} value={company.id}>{company.nombre}</option>)}
                </select>
              </label>
              <label className="access-field">
                <span>Área responsable *</span>
                <select name="area_responsable_id" value={form.area_responsable_id} onChange={handleChange} disabled={!form.empresa_id} required>
                  <option value="">{form.empresa_id ? "Seleccionar" : "Elige una empresa"}</option>
                  {areasEmpresa.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
                </select>
              </label>
              <label className="access-field">
                <span>Área de apoyo</span>
                <select name="area_apoyo_id" value={form.area_apoyo_id} onChange={handleChange} disabled={!form.empresa_id}>
                  <option value="">Sin área de apoyo</option>
                  {areasEmpresa.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
                </select>
              </label>
              <label className="access-field access-field-wide">
                <span>Tipo de trabajo *</span>
                <select name="tipo_trabajo_id" value={form.tipo_trabajo_id} onChange={handleChange} required>
                  <option value="">Seleccionar tipo de trabajo</option>
                  {tiposTrabajo.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}
                </select>
              </label>
              <label className="access-field">
                <span>Trabajo por contrata *</span>
                <select name="trabajo_contrata" value={form.trabajo_contrata} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  <option value="NO">NO</option>
                  <option value="SI">SÍ</option>
                </select>
              </label>
              {form.trabajo_contrata === "SI" && (
                <label className="access-field">
                  <span>Nombre de la contrata *</span>
                  <input name="nombre_contrata" value={form.nombre_contrata} onChange={handleChange} maxLength="150" placeholder="Nombre o razón social" required />
                </label>
              )}
              <label className="access-field access-field-full access-textarea-field">
                <span>Detalle del trabajo</span>
                <textarea name="detalle_trabajo" value={form.detalle_trabajo} onChange={handleChange} maxLength="400" placeholder="Describe las actividades que se realizarán..." />
                <small className="access-counter">{form.detalle_trabajo.length}/400 caracteres</small>
              </label>
            </div>
          </section>

          <section className="access-section">
            <SectionTitle icon={<FaFilePdf />} title="Documentos SCTR" description="Adjunta de 1 a 3 archivos PDF, con un máximo de 10 MiB cada uno." />
            <input id="sctr-input" className="access-file-input" type="file" multiple accept="application/pdf" onChange={handleFiles} />
            <label className="access-upload" htmlFor="sctr-input">
              <FaFilePdf aria-hidden="true" />
              <span><strong>Seleccionar documentos</strong><small>PDF · máximo 3 archivos</small></span>
            </label>
            {archivos.length > 0 && (
              <div className="access-file-list">
                {archivos.map((file, index) => (
                  <div className="access-file-chip" key={`${file.name}-${file.lastModified}`}>
                    <span>{file.name}</span>
                    <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setArchivos((current) => current.filter((_, fileIndex) => fileIndex !== index))}>
                      <FaTimes aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="access-section">
            <SectionTitle icon={<FaUsers />} title="Personal a ingresar" description="El DNI y teléfono de cada persona deben ser únicos y no repetirse." />
            <div className="access-personal-controls">
              <label className="access-field access-count-field">
                <span>N.º de personas *</span>
                <select name="numero_personal" value={form.numero_personal} onChange={handleChange}>
                  {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="access-copy-check">
                <input type="checkbox" checked={copiarSolicitante} onChange={(event) => setCopiarSolicitante(event.target.checked)} />
                <span>
                  <strong>El solicitante también ingresará al nodo</strong>
                  <small>Completar automáticamente los datos del Personal 1.</small>
                </span>
              </label>
            </div>

            <div className="access-people-list">
              {personal.map((person, index) => (
                <fieldset className="access-person-card" key={index} disabled={copiarSolicitante && index === 0}>
                  <legend>Personal {index + 1}{copiarSolicitante && index === 0 ? " · Solicitante" : ""}</legend>
                  <div className="access-grid access-grid-3">
                    <label className="access-field"><span>Nombres *</span><input name="nombre" value={person.nombre} onChange={(event) => handlePersonalChange(index, event)} placeholder="NOMBRES" required /></label>
                    <label className="access-field"><span>Apellido paterno *</span><input name="ap_paterno" value={person.ap_paterno} onChange={(event) => handlePersonalChange(index, event)} placeholder="APELLIDO PATERNO" required /></label>
                    <label className="access-field"><span>Apellido materno *</span><input name="ap_materno" value={person.ap_materno} onChange={(event) => handlePersonalChange(index, event)} placeholder="APELLIDO MATERNO" required /></label>
                    <label className="access-field"><span>Tipo de documento *</span><select name="tipo_doc_id" value={person.tipo_doc_id} onChange={(event) => handlePersonalChange(index, event)} required><option value="">Seleccionar</option>{tiposDoc.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
                    <label className="access-field"><span>N.º de documento *</span><input name="num_doc" value={person.num_doc} onChange={(event) => handlePersonalChange(index, event)} inputMode="numeric" pattern="[0-9]{8}" maxLength="8" placeholder="8 DÍGITOS" required /></label>
                    <label className="access-field"><span>Teléfono *</span><input name="telefono" value={person.telefono} onChange={(event) => handlePersonalChange(index, event)} inputMode="numeric" pattern="9[0-9]{8}" maxLength="9" placeholder="9XXXXXXXX" required /></label>
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <div className="access-actions">
            <button type="button" className="access-btn access-btn-secondary" onClick={() => navigate("/")}><FaArrowLeft /> Atrás</button>
            <button type="submit" className="access-btn access-btn-primary" disabled={sending || Boolean(dateTimeError)}><FaPaperPlane /> Enviar solicitud</button>
          </div>
        </form>
      </main>

      {showModal && (
        <div className="access-modal-overlay">
          <div className="access-modal" role="dialog" aria-modal="true" aria-labelledby="access-result-title">
            {sending ? (
              <><div className="access-spinner" /><h2 id="access-result-title">Enviando solicitud</h2><p>Estamos validando la información y guardando tus documentos.</p></>
            ) : (
              <>
                <span className="access-success-icon"><FaCheckCircle /></span>
                <h2 id="access-result-title">Solicitud enviada</h2>
                {formulariosSiguientes.length > 0 ? (
                  <>
                    <p>Guarda este código para realizar los siguientes formularios:</p>
                    <div className="access-next-forms" aria-label="Formularios siguientes">
                      {formulariosSiguientes.map((formulario) => (
                        <span key={formulario}>{formulario}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>Guarda este código para realizar el seguimiento:</p>
                )}
                <strong className="access-tracking-code">{nuevoId}</strong>
                <button type="button" className="access-btn access-btn-primary" onClick={() => { setShowModal(false); navigate("/"); }}>Volver al inicio</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Acceso;
