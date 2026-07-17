import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaKey,
  FaLock,
  FaShieldAlt,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { obtenerAdministradorActivo } from "../services/auth";
import "./login.css";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [feedback, setFeedback] = useState(
    location.state?.notice
      ? { type: "success", text: location.state.notice }
      : null,
  );

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active || error || !data.user) return;

      try {
        const admin = await obtenerAdministradorActivo(data.user.id);
        if (active && admin) navigate("/dashboard", { replace: true });
      } catch (validationError) {
        console.error(validationError);
      }
    };

    checkSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error("Correo o contraseña incorrectos.");

      const admin = await obtenerAdministradorActivo(data.user?.id);
      if (!admin) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("Este usuario no tiene permisos de administrador.");
      }

      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      console.error(loginError);
      setFeedback({
        type: "error",
        text: loginError.message || "No se pudo iniciar sesión.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback({
        type: "error",
        text: "Escribe primero el correo del administrador.",
      });
      return;
    }

    setRecoveryLoading(true);
    setFeedback(null);
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setRecoveryLoading(false);

    setFeedback(
      error
        ? { type: "error", text: `No se pudo enviar el correo: ${error.message}` }
        : {
            type: "success",
            text: "Enlace enviado. Revisa tu correo y abre el mensaje en este navegador.",
          },
    );
  };

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="admin-login-title">
        <aside className="auth-aside">
          <div className="auth-brand">
            <span><FaShieldAlt aria-hidden="true" /></span>
            <div><strong>WI-NET</strong><small>Centro de operaciones</small></div>
          </div>
          <div className="auth-aside-copy">
            <p>Acceso administrativo</p>
            <h1>Control seguro de solicitudes y operaciones.</h1>
            <span>
              <FaCheckCircle aria-hidden="true" />
              Sesión protegida mientras esta ventana permanezca abierta.
            </span>
          </div>
        </aside>

        <div className="auth-card">
          <button className="auth-back" type="button" onClick={() => navigate("/", { replace: true })}>
            <FaArrowLeft aria-hidden="true" /> Volver al inicio
          </button>

          <header className="auth-header">
            <span className="auth-header-icon"><FaLock aria-hidden="true" /></span>
            <p>Panel administrativo</p>
            <h2 id="admin-login-title">Iniciar sesión</h2>
            <span>Ingresa tus credenciales para continuar.</span>
          </header>

          <form className="auth-form" onSubmit={handleLogin}>
            <label className="auth-field">
              <span>Correo electrónico</span>
              <div className="auth-input-wrap">
                <FaEnvelope aria-hidden="true" />
                <input
                  type="email"
                  placeholder="nombre@empresa.com"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Contraseña</span>
              <div className="auth-input-wrap">
                <FaKey aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </label>

            {feedback && (
              <div className={`auth-feedback auth-feedback-${feedback.type}`} role="status">
                {feedback.text}
              </div>
            )}

            <button className="auth-primary" type="submit" disabled={loading || recoveryLoading}>
              {loading ? <><span className="auth-spinner" /> Validando...</> : "Ingresar al panel"}
            </button>
            <button
              className="auth-link-button"
              type="button"
              onClick={handlePasswordRecovery}
              disabled={loading || recoveryLoading}
            >
              {recoveryLoading ? "Enviando enlace..." : "¿Olvidaste tu contraseña?"}
            </button>
          </form>

          <footer className="auth-security-note">
            <FaShieldAlt aria-hidden="true" /> La sesión se cerrará al cerrar esta ventana.
          </footer>
        </div>
      </section>
    </main>
  );
}

export default AdminLogin;
