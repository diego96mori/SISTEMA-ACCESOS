import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { obtenerAdministradorActivo } from "../services/auth";

function ProtectedRoute({ children }) {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        const admin = await obtenerAdministradorActivo(user?.id);

        if (active) setAuthorized(Boolean(user && admin));
      } catch (error) {
        console.error(error);
        if (active) setAuthorized(false);
      }
    };

    verify();
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) {
    return <p style={{ padding: "2rem" }}>Validando sesión...</p>;
  }

  if (!authorized) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default ProtectedRoute;
