import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaKey,
  FaShieldAlt,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./login.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [validating, setValidating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const requirements = [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Un número", valid: /[0-9]/.test(password) },
  ];
  const passwordIsValid = requirements.every((item) => item.valid);

  useEffect(() => {
    let active = true;

    const validateRecovery = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      setSessionReady(Boolean(data.user && !error));
      setValidating(false);
      if (error || !data.user) {
        setFeedback({
          type: "error",
          text: "El enlace no es válido o ya venció. Solicita uno nuevo.",
        });
      }
    };

    validateRecovery();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
        setValidating(false);
        setFeedback(null);
      }
      if (event === "SIGNED_OUT") setSessionReady(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    if (!passwordIsValid) {
      setFeedback({ type: "error", text: "La contraseña no cumple los requisitos." });
      return;
    }
    if (password !== confirmation) {
      setFeedback({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut({ scope: "global" });
      navigate("/admin", {
        replace: true,
        state: { notice: "Contraseña actualizada. Ya puedes iniciar sesión." },
      });
    } catch (updateError) {
      setFeedback({
        type: "error",
        text: updateError.message || "No se pudo actualizar la contraseña.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell-reset" aria-labelledby="reset-title">
        <aside className="auth-aside">
          <div className="auth-brand">
            <span><FaShieldAlt aria-hidden="true" /></span>
            <div><strong>WI-NET</strong><small>Seguridad de la cuenta</small></div>
          </div>
          <div className="auth-aside-copy">
            <p>Recuperación segura</p>
            <h1>Crea una contraseña nueva y protege tu acceso.</h1>
            <span><FaKey aria-hidden="true" /> El enlace es temporal y de un solo uso.</span>
          </div>
        </aside>

        <div className="auth-card">
          <button className="auth-back" type="button" onClick={() => navigate("/admin", { replace: true })}>
            <FaArrowLeft aria-hidden="true" /> Volver al inicio de sesión
          </button>

          <header className="auth-header">
            <span className="auth-header-icon"><FaKey aria-hidden="true" /></span>
            <p>Seguridad</p>
            <h2 id="reset-title">Cambiar contraseña</h2>
            <span>Usa una combinación segura que puedas recordar.</span>
          </header>

          {validating ? (
            <div className="auth-validating" role="status">
              <span className="auth-spinner auth-spinner-dark" /> Validando enlace seguro...
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Nueva contraseña</span>
                <div className="auth-input-wrap">
                  <FaKey aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!sessionReady || loading}
                    required
                  />
                  <button className="auth-password-toggle" type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </label>

              <div className="auth-requirements" aria-label="Requisitos de la contraseña">
                {requirements.map((requirement) => (
                  <span className={requirement.valid ? "is-valid" : ""} key={requirement.label}>
                    <FaCheck aria-hidden="true" /> {requirement.label}
                  </span>
                ))}
              </div>

              <label className="auth-field">
                <span>Confirmar contraseña</span>
                <div className="auth-input-wrap">
                  <FaKey aria-hidden="true" />
                  <input
                    type={showConfirmation ? "text" : "password"}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={!sessionReady || loading}
                    required
                  />
                  <button className="auth-password-toggle" type="button" aria-label={showConfirmation ? "Ocultar confirmación" : "Mostrar confirmación"} onClick={() => setShowConfirmation((current) => !current)}>
                    {showConfirmation ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </label>

              {feedback && (
                <div className={`auth-feedback auth-feedback-${feedback.type}`} role="status">
                  {feedback.text}
                </div>
              )}

              <button className="auth-primary" type="submit" disabled={!sessionReady || loading}>
                {loading ? <><span className="auth-spinner" /> Guardando...</> : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default ResetPassword;
