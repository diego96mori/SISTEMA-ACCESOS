import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker";
import "./Acceso.css";

function Acceso() {

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
    numero_personal: 1
  });

  const [horaIngreso, setHoraIngreso] = useState(null);
  const [horaSalida, setHoraSalida] = useState(null);
  const [viewIngreso, setViewIngreso] = useState("hours");
  const [viewSalida, setViewSalida] = useState("hours");

  const [correoUser, setCorreoUser] = useState("");


  const [showModal, setShowModal] = useState(false);
const [sending, setSending] = useState(false);
const [mostrarId, setMostrarId] = useState(false);
const [nuevoId, setNuevoId] = useState(null);

  const [correoDominio, setCorreoDominio] = useState("");

  const navigate = useNavigate();

const [archivo, setArchivo] = useState([]);

  const [nodos, setNodos] = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tiposTrabajo, setTiposTrabajo] = useState([]);

  const [personal, setPersonal] = useState([
    { nombre:"", ap_paterno:"", ap_materno:"", tipo_doc_id:"", num_doc:"", telefono:"" }
  ]);

  useEffect(()=>{ cargarCatalogos(); },[]);

  const cargarCatalogos = async ()=>{
    const { data: nodos } = await supabase.from("nodos").select("*");
    const { data: tiposDoc } = await supabase.from("tipos_documento").select("*");
    const { data: niveles } = await supabase.from("niveles_acceso").select("*");
    const { data: empresas } = await supabase.from("empresas").select("*");
    const { data: areas } = await supabase.from("areas").select("*");
    const { data: tiposTrabajo } = await supabase.from("tipos_trabajo").select("*");

    setNodos(nodos || []);
    setTiposDoc(tiposDoc || []);
    setNiveles(niveles || []);
    setEmpresas(empresas || []);
    setAreas(areas || []);
    setTiposTrabajo(tiposTrabajo || []);
  };

const handleChange = (e)=>{
  const { name,value } = e.target;

  if(name === "numero_personal"){
    const cantidad = parseInt(value);

    setForm(prev => ({
      ...prev,
      numero_personal: cantidad
    }));

    const nuevo = Array.from({length:cantidad},()=>({
      nombre:"", ap_paterno:"", ap_materno:"", tipo_doc_id:"", num_doc:"", telefono:""
    }));

    setPersonal(nuevo);
    return;
  }

  setForm(prev => ({
    ...prev,
    [name]: value
  }));
};

  const handlePersonalChange = (index,e)=>{
    const { name,value } = e.target;
    const copia = [...personal];
    copia[index][name] = value;
    setPersonal(copia);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    setSending(true);
    setShowModal(true);

    let sctrPaths = [];
    let sctrFileNames = [];
    let sctrSizes = [];

    if (archivo.length === 0) {
      alert("Debes subir al menos un PDF");
      return;
    }

    for (const file of archivo) {

      if (file.type !== "application/pdf") {
        alert("Solo se permiten archivos PDF");
        return;
      }

      const cleanName = file.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]/g, "_");

      const filePath = `${Date.now()}_${cleanName}`;

      const { error: uploadError } =
        await supabase.storage.from("sctr").upload(filePath, file);

      if (uploadError) throw uploadError;

      sctrPaths.push(filePath);
      sctrFileNames.push(cleanName);
      sctrSizes.push(file.size);
    }

    const { data: accesoInsertado, error: accesoError } =
      await supabase
        .from("accesos")
        .insert([{
  ...form,

  trabajo_contrata: form.trabajo_contrata === "SI",

  nombre_contrata:
    form.trabajo_contrata === "SI"
      ? form.nombre_contrata
      : null,

  sctr_path: sctrPaths,
  sctr_filename: sctrFileNames,
  sctr_size: sctrSizes
}])
        .select()
        .single();

    if (accesoError) throw accesoError;

    const personalInsert = personal.map(p => ({
      ...p,
      acceso_id: accesoInsertado.id
    }));

    const { error: personalError } =
      await supabase.from("personal_acceso").insert(personalInsert);

    if (personalError) throw personalError;

    // ===============================
    // LOGICA PARA MOSTRAR ID
    // ===============================

    const nodoSeleccionado = nodos.find(n => n.id == form.nodo_id);
    const tipoTrabajoSeleccionado = tiposTrabajo.find(t => t.id == form.tipo_trabajo_id);

    const trabajosValidos = [
      "INSTALACION DE EQUIPOS",
      "RETIRO DE EQUIPOS",
      "REEMPLAZO DE EQUIPOS",
      "INGRESO_FO"
    ];

    const mostrar =
      nodoSeleccionado?.requiere_llave === true ||
      trabajosValidos.includes(tipoTrabajoSeleccionado?.nombre);

    setNuevoId(accesoInsertado.id);
    setMostrarId(mostrar);

    setSending(false);

  } catch (err) {
    console.error(err);
    alert("Error al enviar solicitud");
    setShowModal(false);
    setSending(false);
  }
};
  return (
    <><div className="brand-container">
      <div className="brandbar">
        WIN | Acceso a Nodos
      </div>
    </div><div className="form-wrapper">

        <div className="form-card">



          <form onSubmit={handleSubmit}>

            <h5 className="section-title">Nodo a ingresar</h5>
            <hr />

            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale="es"
              localeText={{
                timePickerToolbarTitle: "Seleccionar Hora",
                cancelButtonLabel: "Cancelar",
                okButtonLabel: "Aceptar"
              }}
            >

              <div className="row g-3 nodo-section">

                <div className="col-md-4">
                  <label>Nodo</label>
                  <select className="form-select" name="nodo_id" value={form.nodo_id} onChange={handleChange} required>
                    <option value="">Seleccionar</option>
                    {nodos.map(n => (
                      <option key={n.id} value={n.id}>{n.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label>Fecha ingreso</label>
                  <input type="date" className="form-control" name="fecha_ingreso" onChange={handleChange} required />
                </div>

                <div className="col-md-4">
                  <label>Fecha salida</label>
                  <input type="date" className="form-control" name="fecha_salida" onChange={handleChange} required />
                </div>

                {/* HORA INGRESO */}
                <div className="col-md-4">
                  <label>Hora ingreso</label>

                  <MobileTimePicker
                    orientation="portrait"
                    value={horaIngreso}
                    onChange={(newValue) => {
                      setHoraIngreso(newValue);
                      setForm({
                        ...form,
                        hora_ingreso: newValue ? newValue.format("HH:mm") : ""
                      });
                    } }
                    views={["hours", "minutes"]}
                    ampm={false}
                    closeOnSelect={false}
                    slotProps={{
                      actionBar: {
                        actions: ["cancel", "accept"]
                      },
                      textField: {
                        fullWidth: true,
                        size: "small"
                      }
                    }} />
                </div>

                {/* HORA SALIDA */}
                <div className="col-md-4">
                  <label>Hora salida</label>

                  <MobileTimePicker
                    orientation="portrait"
                    value={horaSalida}
                    onChange={(newValue) => {
                      setHoraSalida(newValue);
                      setForm({
                        ...form,
                        hora_salida: newValue ? newValue.format("HH:mm") : ""
                      });
                    } }
                    views={["hours", "minutes"]}
                    ampm={false}
                    closeOnSelect={false}
                    slotProps={{
                      actionBar: {
                        actions: ["cancel", "accept"]
                      },
                      textField: {
                        fullWidth: true,
                        size: "small"
                      }
                    }} />

                </div>

              </div>
            </LocalizationProvider>

            {/* ================= SOLICITANTE ================= */}
          <h5 className="section-title mt-4">Solicitante encargado</h5>
<hr />

<div className="row g-3">

  <div className="col-md-3">
    <input
      className="form-control"
      placeholder="Nombres"
      name="solicitante_nombre"
      value={form.solicitante_nombre}
      onChange={handleChange}
      required
    />
  </div>

  <div className="col-md-3">
    <input
      className="form-control"
      placeholder="Ap. paterno"
      name="solicitante_ap_paterno"
      value={form.solicitante_ap_paterno}
      onChange={handleChange}
      required
    />
  </div>

  <div className="col-md-3">
    <input
      className="form-control"
      placeholder="Ap. materno"
      name="solicitante_ap_materno"
      value={form.solicitante_ap_materno}
      onChange={handleChange}
      required
    />
  </div>

  <div className="col-md-3">
    <input
      className="form-control"
      placeholder="Teléfono"
      name="solicitante_telefono"
      value={form.solicitante_telefono}
      onChange={handleChange}
      required
    />
  </div>

  <div className="col-md-4">
    <select
      className="form-select"
      name="solicitante_tipo_doc_id"
      value={form.solicitante_tipo_doc_id}
      onChange={handleChange}
      required
    >
      <option value="">Tipo documento</option>
      {tiposDoc.map(t => (
        <option key={t.id} value={t.id}>{t.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-4">
    <input
      className="form-control"
      placeholder="N° documento"
      name="solicitante_num_doc"
      value={form.solicitante_num_doc}
      onChange={handleChange}
      required
    />
  </div>

  <div className="col-md-4">
    <div className="correo-group">

      <input
        type="text"
        className="form-control correo-user"
        placeholder="USUARIO"
        value={correoUser}
        onChange={(e) => {
          const usuario = e.target.value;
          setCorreoUser(usuario);

          setForm(prev => ({
  ...prev,
  solicitante_correo: correoDominio
    ? `${usuario}${correoDominio}`
    : usuario
}));
        }}
        required
      />

      <select
        className="form-select correo-domain"
        value={correoDominio}
        onChange={(e) => {
          const dominio = e.target.value;
          setCorreoDominio(dominio);

          setForm(prev => ({
  ...prev,
  solicitante_correo: correoUser
    ? `${correoUser}${dominio}`
    : ""
}));
        }}
        required
      >
        <option value="">— Dominio —</option>
        <option value="@win.pe">@win.pe</option>
        <option value="@on.pe">@on.pe</option>
      </select>

    </div>
  </div>

</div>

            {/* ================= TRABAJO ================= */}
         <h5 className="section-title mt-4">Trabajo a realizar</h5>
<hr />

<div className="row g-3">

  <div className="col-md-3">
    <select
      className="form-select"
      name="nivel_acceso_id"
      value={form.nivel_acceso_id}
      onChange={handleChange}
      required
    >
      <option value="">Nivel acceso</option>
      {niveles.map(n => (
        <option key={n.id} value={n.id}>{n.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-3">
    <select
      className="form-select"
      name="empresa_id"
      value={form.empresa_id}
      onChange={handleChange}
      required
    >
      <option value="">Empresa</option>
      {empresas.map(e => (
        <option key={e.id} value={e.id}>{e.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-3">
    <select
      className="form-select"
      name="area_responsable_id"
      value={form.area_responsable_id}
      onChange={handleChange}
      required
    >
      <option value="">Área responsable</option>
      {areas.map(a => (
        <option key={a.id} value={a.id}>{a.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-3">
    <select
      className="form-select"
      name="area_apoyo_id"
      value={form.area_apoyo_id}
      onChange={handleChange}
    >
      <option value="">Área apoyo</option>
      {areas.map(a => (
        <option key={a.id} value={a.id}>{a.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-3">
    <select
      className="form-select"
      name="tipo_trabajo_id"
      value={form.tipo_trabajo_id}
      onChange={handleChange}
      required
    >
      <option value="">Tipo trabajo</option>
      {tiposTrabajo.map(t => (
        <option key={t.id} value={t.id}>{t.nombre}</option>
      ))}
    </select>
  </div>

  <div className="col-md-3">
    <select
      className="form-select"
      name="trabajo_contrata"
      value={form.trabajo_contrata}
      onChange={(e) =>
  setForm(prev => ({
    ...prev,
    trabajo_contrata: e.target.value
  }))
}
      required
    >
      <option value="">Trabajo por contrata</option>
      <option value="NO">NO</option>
      <option value="SI">SI</option>
    </select>
  </div>

  {/* 👇 SOLO aparece si es SI */}
  {form.trabajo_contrata === "SI" && (
    <div className="col-md-3">
      <input
        className="form-control"
        placeholder="Nombre contrata"
        name="nombre_contrata"
        value={form.nombre_contrata}
        onChange={handleChange}
        required
      />
    </div>
  )}

  <div className="col-md-6">
    <textarea
      className="form-control"
      placeholder="Detalle del trabajo"
      name="detalle_trabajo"
      value={form.detalle_trabajo}
      onChange={handleChange}
    />
  </div>

</div>

            {/* ================= SCTR ================= */}
<h5 className="section-title mt-3">SCTR</h5>
<hr />

<div className="sctr-wrapper">

  {/* Input oculto */}
  <input
    type="file"
    id="sctrInput"
    multiple
    accept="application/pdf"
    style={{ display: "none" }}
    onChange={(e) => {
      const nuevos = Array.from(e.target.files);
      const todos = [...archivo, ...nuevos];

      if (todos.length > 3) {
        alert("Solo puedes subir hasta 3 PDFs");
        return;
      }

      const invalid = todos.some(f => f.type !== "application/pdf");
      if (invalid) {
        alert("Solo se permiten archivos PDF");
        return;
      }

      setArchivo(todos);
    }}
  />

  {/* Caja visual personalizada */}
  <div className="sctr-box">

    <button
      type="button"
      className="btn-select"
      onClick={() => document.getElementById("sctrInput").click()}
    >
      Elegir archivos
    </button>

    <div className="sctr-inside">
      {archivo.length === 0 && (
        <span className="placeholder-text">
          Ningún archivo seleccionado
        </span>
      )}

      {archivo.map((file, index) => (
        <div key={index} className="chip">
          <span className="chip-text">{file.name}</span>
          <span
            className="chip-remove"
            onClick={() => {
              const copia = archivo.filter((_, i) => i !== index);
              setArchivo(copia);
            }}
          >
            ✕
          </span>
        </div>
      ))}
    </div>

  </div>
</div>
            {/* ================= PERSONAL ================= */}
            <h5 className="section-title mt-4">Personal a ingresar</h5>
            <hr />

           <div className="mb-3 personal-count">
  <label className="me-2 fw-semibold">Personal N°</label>

  <input
    type="number"
    className="form-control personal-input"
    min="1"
    max="8"
    name="numero_personal"
    value={form.numero_personal}
    onChange={handleChange}
    required
  />
</div>

            {personal.map((p, index) => (
              <div key={index} className="border rounded p-3 mb-3">
                <h6>Personal {index + 1}</h6>

                <div className="row g-3">

                  <div className="col-md-3">
                    <input className="form-control"
                      placeholder="Nombres"
                      name="nombre"
                      value={p.nombre}
                      onChange={(e) => handlePersonalChange(index, e)}
                      required />
                  </div>

                  <div className="col-md-3">
                    <input className="form-control"
                      placeholder="Ap. paterno"
                      name="ap_paterno"
                      value={p.ap_paterno}
                      onChange={(e) => handlePersonalChange(index, e)}
                      required />
                  </div>

                  <div className="col-md-3">
                    <input className="form-control"
                      placeholder="Ap. materno"
                      name="ap_materno"
                      value={p.ap_materno}
                      onChange={(e) => handlePersonalChange(index, e)}
                      required />
                  </div>

                  <div className="col-md-3">
                    <select className="form-select"
                      name="tipo_doc_id"
                      value={p.tipo_doc_id}
                      onChange={(e) => handlePersonalChange(index, e)}
                      required>
                      <option value="">Tipo doc</option>
                      {tiposDoc.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <input className="form-control"
                      placeholder="N° documento"
                      name="num_doc"
                      value={p.num_doc}
                      onChange={(e) => handlePersonalChange(index, e)}
                      required />
                  </div>

                  <div className="col-md-6">
                    <input className="form-control"
                      placeholder="Teléfono"
                       value={p.telefono}
                      name="telefono"
                      onChange={(e) => handlePersonalChange(index, e)}
                      required />
                  </div>

                </div>
              </div>
            ))}

           <div className="mt-4 d-flex gap-3">

  <button
    type="button"
    className="btn btn-secondary fw-bold same-btn"
    onClick={() => navigate("/")}
  >
    Atrás
  </button>

  <button
    type="submit"
    className="btn btn-warning fw-bold same-btn"
  >
    Enviar solicitud
  </button>

</div>

          </form>
          </div>
</div>
       {showModal && (
  <div className="modal-overlay">
    <div className="modal-box">

      {sending ? (
        <>
          <div className="spinner-border text-warning mb-3"></div>
          <h5>Enviando solicitud...</h5>
        </>
      ) : (
        <>
          <h5 style={{ marginBottom: "10px" }}>
            Solicitud enviada correctamente
          </h5>

          {mostrarId && (
            <p style={{ fontWeight: "bold", fontSize: "16px" }}>
              Su ID es: {nuevoId}
            </p>
          )}

          <button
            className="btn-confirm"
            onClick={() => {
              setShowModal(false);
              navigate("/");
            }}
          >
            Aceptar
          </button>
        </>
      )}

    </div>
  </div>
)} 

  </>
  
  );
}

export default Acceso;