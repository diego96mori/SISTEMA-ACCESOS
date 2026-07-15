import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDoorOpen, FaKey, FaTools, FaUserShield } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [codigoSeguimiento, setCodigoSeguimiento] = useState("");
  const [formulario, setFormulario] = useState("EQUIPOS");
  const [loading, setLoading] = useState(false);

  const abrirValidacion = (tipo) => {
    setFormulario(tipo);
    setCodigoSeguimiento("");
    setModalMsg("");
    setShowModal(true);
  };

  const validarAcceso = async () => {
    const codigo = codigoSeguimiento.trim();
    if (!codigo) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("validar_codigo_formulario", {
      p_codigo: codigo,
      p_formulario: formulario,
    });
    setLoading(false);

    if (error) {
      setModalMsg("El código no tiene un formato válido.");
      return;
    }

    const messages = {
      NO_EXISTE: "El código de seguimiento no existe.",
      NO_AUTORIZADO:
        "La solicitud todavía no está aprobada o no requiere este formulario.",
      DENEGADO: "La solicitud fue denegada.",
      CANCELADO: "La solicitud fue cancelada.",
      YA_REGISTRADO: "Este formulario ya fue registrado.",
    };

    if (data !== "AUTORIZADO") {
      setModalMsg(messages[data] || "No se pudo validar la solicitud.");
      return;
    }

    setShowModal(false);
    navigate(
      formulario === "EQUIPOS"
        ? `/instalaciones/${codigo}`
        : `/llaves/${codigo}`,
    );
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

          <button onClick={() => abrirValidacion("EQUIPOS")}>
            <FaTools />
            GESTIÓN DE EQUIPOS (INSTALACIONES, RETIRO, REEMPLAZO E INGRESO DE F.O.)
          </button>

          <button onClick={() => abrirValidacion("LLAVES")}>
            <FaKey />
            LLAVES
          </button>
        </div>

        <button className="admin-btn" onClick={() => navigate("/admin")}>
          <FaUserShield />
          INICIAR SESIÓN (ADMIN)
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>
              {modalMsg
                ? "Validación de solicitud"
                : formulario === "EQUIPOS"
                  ? "Gestionar equipos"
                  : "Solicitar llave"}
            </h3>

            <p
              style={{
                color: modalMsg ? "#dc3545" : "#555",
                fontWeight: modalMsg ? "600" : "normal",
                marginBottom: "15px",
              }}
            >
              {modalMsg ? modalMsg : "Ingrese su código de seguimiento"}
            </p>

            <input
              type="text"
              placeholder="Ej: a6aee268-71b8-466c-a711-1c35750ebe3b"
              value={codigoSeguimiento}
              onChange={(event) => {
                setCodigoSeguimiento(event.target.value);
                if (modalMsg) setModalMsg("");
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
                onClick={validarAcceso}
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
