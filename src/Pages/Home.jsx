import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaCheckCircle,
  FaDoorOpen,
  FaKey,
  FaTimes,
  FaTools,
  FaUserShield,
} from "react-icons/fa";
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

    if (data === "YA_REGISTRADO") {
      if (formulario === "EQUIPOS") {
        setShowModal(false);
        navigate(`/instalaciones/${codigo}`);
        return;
      }

      const { data: trackingRows, error: trackingError } = await supabase.rpc(
        "consultar_seguimiento",
        { p_codigo: codigo },
      );
      const tracking = Array.isArray(trackingRows)
        ? trackingRows[0]
        : trackingRows;

      if (!trackingError && tracking) {
        const movementMessages = {
          PENDIENTE:
            "El formulario fue registrado y está pendiente de revisión.",
          EN_REVISION:
            "El formulario está siendo revisado por el administrador.",
          PROCESANDO:
            "La solicitud se está procesando actualmente en NetBox.",
          APROBADO:
            "La solicitud fue aprobada y procesada correctamente en NetBox.",
          DENEGADO: "La solicitud de equipos fue denegada.",
          ERROR:
            "Ocurrió un error al procesar la solicitud. El administrador debe revisarla.",
        };
        setModalMsg(
          movementMessages[tracking.estado_movimiento] ||
            "Este formulario ya fue registrado.",
        );
        return;
      }
    }

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
      <main className="home-shell">
        <section className="home-intro" aria-labelledby="home-heading">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <FaDoorOpen />
            </span>
            <span>
              <strong className="brand-name">WI-NET</strong>
              <small className="brand-caption">Gestión de operaciones</small>
            </span>
          </div>

          <div className="home-copy">
            <p className="home-eyebrow">
              <FaCheckCircle aria-hidden="true" /> Plataforma centralizada
            </p>
            <h1 className="home-heading" id="home-heading">
              Sistema de <span>solicitudes</span>
            </h1>
            <p className="home-description">
              Gestiona accesos, movimientos de equipos y llaves desde un solo
              lugar, con seguimiento seguro durante todo el proceso.
            </p>
          </div>

          <div className="home-trust">
            <span className="trust-icon" aria-hidden="true">
              <FaUserShield />
            </span>
            <span>Acceso controlado y trazabilidad de cada solicitud</span>
          </div>
        </section>

        <section className="home-panel" aria-labelledby="panel-heading">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">Menú principal</p>
              <h2 id="panel-heading">¿Qué deseas gestionar?</h2>
            </div>
            <span className="panel-status">Sistema disponible</span>
          </header>

          <div className="home-actions">
            <button className="action-card" onClick={() => navigate("/acceso")}>
              <span className="action-icon" aria-hidden="true">
                <FaDoorOpen />
              </span>
              <span className="action-content">
                <strong>Acceso</strong>
                <span>Registra una nueva solicitud de ingreso.</span>
              </span>
              <FaArrowRight className="action-arrow" aria-hidden="true" />
            </button>

            <button
              className="action-card"
              onClick={() => abrirValidacion("EQUIPOS")}
            >
              <span className="action-icon" aria-hidden="true">
                <FaTools />
              </span>
              <span className="action-content">
                <strong>Gestión de equipos</strong>
                <span>Instalaciones, retiro, reemplazo e ingreso de F.O.</span>
              </span>
              <FaArrowRight className="action-arrow" aria-hidden="true" />
            </button>

            <button
              className="action-card"
              onClick={() => abrirValidacion("LLAVES")}
            >
              <span className="action-icon" aria-hidden="true">
                <FaKey />
              </span>
              <span className="action-content">
                <strong>Llaves</strong>
                <span>Solicita y administra el préstamo de llaves.</span>
              </span>
              <FaArrowRight className="action-arrow" aria-hidden="true" />
            </button>
          </div>

          <footer className="panel-footer">
            <div className="panel-footer-copy">
              <span>¿Eres administrador?</span>
              <strong>Ingresa al panel de control</strong>
            </div>
            <button className="admin-btn" onClick={() => navigate("/admin")}>
              <FaUserShield aria-hidden="true" />
              Iniciar sesión
            </button>
          </footer>
        </section>
      </main>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowModal(false);
          }}
        >
          <form
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="validation-title"
            onSubmit={(event) => {
              event.preventDefault();
              validarAcceso();
            }}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar ventana"
              onClick={() => setShowModal(false)}
            >
              <FaTimes aria-hidden="true" />
            </button>

            <span className="modal-icon" aria-hidden="true">
              {formulario === "EQUIPOS" ? <FaTools /> : <FaKey />}
            </span>

            <h3 id="validation-title">
              {modalMsg
                ? "Validación de solicitud"
                : formulario === "EQUIPOS"
                  ? "Gestionar equipos"
                  : "Solicitar llave"}
            </h3>

            <p className={`modal-message${modalMsg ? " is-error" : ""}`}>
              {modalMsg
                ? modalMsg
                : "Ingresa el código recibido al registrar tu solicitud."}
            </p>

            <div className="modal-field">
              <label htmlFor="codigo-seguimiento">Código de seguimiento</label>
              <input
                id="codigo-seguimiento"
                type="text"
                autoFocus
                autoComplete="off"
                placeholder="Ej: a6aee268-71b8-466c-a711-1c35750ebe3b"
                value={codigoSeguimiento}
                onChange={(event) => {
                  setCodigoSeguimiento(event.target.value);
                  if (modalMsg) setModalMsg("");
                }}
              />
            </div>

            <div className="modal-buttons">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={loading || !codigoSeguimiento.trim()}
              >
                {loading ? "Validando..." : "Aceptar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Home;
