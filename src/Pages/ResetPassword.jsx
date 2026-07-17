import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./login.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Validando enlace de recuperacion...");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const ready = Boolean(data.session);
      setSessionReady(ready);
      setMessage(
        ready
          ? "Escribe tu nueva contrasena"
          : "El enlace no es valido o ya vencio. Solicita uno nuevo.",
      );
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setSessionReady(true);
          setMessage("Escribe tu nueva contrasena");
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password.length < 8) {
      setMessage("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contrasenas no coinciden");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      alert("Contrasena actualizada correctamente");
      navigate("/admin", { replace: true });
    } catch (error) {
      setMessage(error.message || "No se pudo actualizar la contrasena");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <p className="back-link" onClick={() => navigate("/admin")}>
          Volver al login
        </p>
        <h2>Cambiar contrasena</h2>
        <p style={{ textAlign: "center" }}>{message}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!sessionReady || loading}
            required
          />
          <input
            type="password"
            placeholder="Confirmar contrasena"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={!sessionReady || loading}
            required
          />
          <button type="submit" disabled={!sessionReady || loading}>
            {loading ? "GUARDANDO..." : "CAMBIAR CONTRASENA"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
