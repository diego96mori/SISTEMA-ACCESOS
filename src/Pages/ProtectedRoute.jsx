import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    getSession();
  }, []);

  if (loading) return null;

  if (!session) {
    return <Navigate to="/admin" />;
  }

  return children;
}

export default ProtectedRoute;