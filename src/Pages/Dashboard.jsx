import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ============================== */
  /* CARGAR SESIÓN + ACCESOS */
  /* ============================== */

  useEffect(() => {
    verificarSesion();
    cargarAccesos();
  }, []);

  const verificarSesion = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      navigate("/");
      return;
    }
    setUser(data.user);
  };

  const cargarAccesos = async () => {
    const { data, error } = await supabase
      .from("accesos")
      .select(`
        id,
        fecha_ingreso,
        fecha_salida,
        estado,
        nodos ( nombre ),
        tipos_trabajo ( nombre )
      `)
      .order("id", { ascending: false });

    if (!error) {
      setAccesos(data || []);
    }

    setLoading(false);
  };

  /* ============================== */
  /* LOGOUT */
  /* ============================== */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  /* ============================== */
  /* RETURN */
  /* ============================== */

  return (
    <div className="dashboard-container">

      <div className="dashboard-header">
        <div>
          <div className="dashboard-title">Dashboard</div>
          {user && (
            <div className="dashboard-user">
              Bienvenido: {user.email}
            </div>
          )}
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <h3>Lista de Accesos</h3>

      {loading ? (
        <p>Cargando accesos...</p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nodo</th>
              <th>Tipo Trabajo</th>
              <th>Fecha Ingreso</th>
              <th>Fecha Salida</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {accesos.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.nodos?.nombre}</td>
                <td>{a.tipos_trabajo?.nombre}</td>
                <td>{a.fecha_ingreso}</td>
                <td>{a.fecha_salida}</td>
                <td
                 className={
  a.estado === "AUTORIZADO"
    ? "estado-autorizado"
    : a.estado === "CANCELADO"
    ? "estado-cancelado"
    : "estado-registrado"
}
                >
                  {a.estado}
                </td>
                <td>
                  <button
                    className="action-btn"
                    onClick={() => navigate(`/instalaciones/${a.id}`)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  );
}

export default Dashboard;