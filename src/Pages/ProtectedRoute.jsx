import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FaShieldAlt } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { obtenerAdministradorActivo } from "../services/auth";
import "./login.css";

function ProtectedRoute({ children }) {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (active) setAuthorized(false);
          return;
        }

        const admin = await obtenerAdministradorActivo(data.user.id);
        if (active) setAuthorized(Boolean(admin));
      } catch (error) {
        console.error(error);
        if (active) setAuthorized(false);
      }
    };

    verify();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) setAuthorized(false);
    });
    window.addEventListener("pageshow", verify);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("pageshow", verify);
    };
  }, []);

  if (authorized === null) {
    return (
      <main className="route-auth-loading" role="status">
        <FaShieldAlt aria-hidden="true" />
        <span className="auth-spinner auth-spinner-dark" />
        <p>Validando sesión segura...</p>
      </main>
    );
  }

  if (!authorized) return <Navigate to="/admin" replace />;
  return children;
}

export default ProtectedRoute;
