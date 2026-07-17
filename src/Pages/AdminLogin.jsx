import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { obtenerAdministradorActivo } from "../services/auth";
import { useNavigate } from "react-router-dom";
import "./login.css";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const admin = await obtenerAdministradorActivo(data.session?.user?.id);
      if (data.session && admin) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Credenciales incorrectas");
      return;
    }

    try {
      const admin = await obtenerAdministradorActivo(data.user?.id);
      if (!admin) {
        await supabase.auth.signOut();
        alert("El usuario no tiene permisos de administrador");
        return;
      }

      navigate("/dashboard");
    } catch (validationError) {
      console.error(validationError);
      await supabase.auth.signOut();
      alert("No se pudo validar el perfil administrador");
    }
  };

  const handlePasswordRecovery = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setRecoveryMessage("Escribe primero el correo del administrador");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    setRecoveryMessage(
      error
        ? `No se pudo enviar el correo: ${error.message}`
        : "Revisa tu correo para cambiar la contrasena",
    );
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">

         <p 
  className="back-link"
  onClick={() => navigate("/")}>
  ← Volver al inicio
</p>
        <h2>Admin Login</h2>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">LOGIN</button>
          <button
            type="button"
            onClick={handlePasswordRecovery}
            style={{ marginTop: "10px" }}
          >
            OLVIDE MI CONTRASENA
          </button>
          {recoveryMessage && (
            <p style={{ marginTop: "12px", textAlign: "center" }}>
              {recoveryMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
