import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const { data } = await supabase
      .from("accesos")
      .select(`
        id,
        fecha_ingreso,
        hora_ingreso,
        estado,
        detalle_trabajo,
        trabajo_contrata,
        nombre_contrata,
        nodos ( nombre ),
        tipos_trabajo ( nombre ),
        empresas ( nombre ),
        areas_responsable:area_responsable_id ( nombre ),
        areas_apoyo:area_apoyo_id ( nombre ),
        solicitante_nombre,
        solicitante_ap_paterno,
        solicitante_ap_materno,
        solicitante_tipo_doc_id,
        solicitante_num_doc,
        solicitante_telefono,
        solicitante_correo
      `)
      .order("id", { ascending: false });

    setAccesos(data || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">WI-NET</h2>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          Lista de Accesos
        </button>
      </aside>

      {/* MAIN */}
      <div className="flex-1 p-8">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Lista de Accesos</h1>
            {user && (
              <p className="text-sm text-gray-500">{user.email}</p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Cerrar sesión
          </button>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow overflow-auto">
          {loading ? (
            <p className="p-6">Cargando...</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3">Nodo</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Correo</th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Área Responsable</th>
                  <th className="p-3">Área Apoyo</th>
                  <th className="p-3">Tipo Trabajo</th>
                  <th className="p-3">Detalle</th>
                  <th className="p-3">Contrata</th>
                </tr>
              </thead>

              <tbody>
                {accesos.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{a.nodos?.nombre}</td>
                    <td className="p-3">{a.fecha_ingreso}</td>
                    <td className="p-3">{a.hora_ingreso}</td>
                    <td className="p-3">
                      {a.solicitante_nombre} {a.solicitante_ap_paterno} {a.solicitante_ap_materno}
                    </td>
                    <td className="p-3">{a.solicitante_num_doc}</td>
                    <td className="p-3">{a.solicitante_telefono}</td>
                    <td className="p-3">{a.solicitante_correo}</td>
                    <td className="p-3">{a.empresas?.nombre}</td>
                    <td className="p-3">{a.areas_responsable?.nombre}</td>
                    <td className="p-3">{a.areas_apoyo?.nombre}</td>
                    <td className="p-3">{a.tipos_trabajo?.nombre}</td>
                    <td className="p-3">{a.detalle_trabajo}</td>
                    <td className="p-3">
                      {a.trabajo_contrata === "SI"
                        ? a.nombre_contrata
                        : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

export default Dashboard;