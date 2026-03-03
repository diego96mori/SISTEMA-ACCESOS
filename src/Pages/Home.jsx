import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaDoorOpen, FaTools, FaKey, FaUserShield } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [accesoId, setAccesoId] = useState("");
  const [loading, setLoading] = useState(false);

  const validarAcceso = async () => {
  if (!accesoId) return;

  if (isNaN(accesoId)) {
    setModalMsg("El ID debe ser numérico");
    setAccesoId("");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase
    .rpc("validar_acceso_instalaciones", { p_id: Number(accesoId) });

  setLoading(false);

  if (error) {
    setModalMsg("Error interno al validar acceso.");
    return;
  }

  if (data === "NO_EXISTE") {
    setModalMsg("El ID ingresado no existe.");
    setAccesoId("");
    return;
  }

  if (data === "NO_AUTORIZADO") {
    setModalMsg("Este acceso no está autorizado para gestionar instalaciones.");
    setAccesoId("");
    return;
  }

  if (data === "AUTORIZADO") {
    setShowModal(false);
    navigate(`/instalaciones/${accesoId}`);
  }
};

  return (
    <div className="home-container">
      <div className="home-card">

        <h1 className="brand-title">WI-NET</h1>
        <h2 className="home-title">Sistema de Solicitudes</h2>

        <div className="home-buttons">
          <button onClick={() => navigate("/acceso")}>
            <FaDoorOpen />
            ACCESO
          </button>

          <button onClick={() => setShowModal(true)}>
            <FaTools />
            GESTION DE EQUIPOS (INSTALACIONES , RETIRO , REEMPLAZO Y INGRESO DE F.O)
          </button>

          <button onClick={() => navigate("/llaves")}>
            <FaKey />
            LLAVES
          </button>
        </div>

        <button
          className="admin-btn"
          onClick={() => navigate("/admin")}
        >
          <FaUserShield />
          INICIAR SESIÓN (ADMIN)
        </button>

      </div>

      {/* MODAL PERSONALIZADO */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>
  {modalMsg ? "Validación de acceso" : "Gestionar Instalaciones"}
</h3>

<p
  style={{
    color: modalMsg ? "#dc3545" : "#555",
    fontWeight: modalMsg ? "600" : "normal",
    marginBottom: "15px"
  }}
>
  {modalMsg ? modalMsg : "Ingrese ID de acceso"}
</p>

          <input
  type="number"
  placeholder="Ej: 5"
  value={accesoId}
  onChange={(e) => {
    setAccesoId(e.target.value);
    if (modalMsg) setModalMsg(""); // 🔥 limpia el mensaje al escribir
  }}
/>

            <div className="modal-buttons">
              <button
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>

              <button
                className="btn-confirm"
                onClick={() => {
  if (modalMsg) {
    setModalMsg("");
    setShowModal(false);
  } else {
    validarAcceso();
  }
}}
                disabled={loading}
              >
                {loading ? "Validando..." : "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;