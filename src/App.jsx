import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Acceso from "./Pages/Acceso";
import Instalaciones from "./Pages/Instalaciones";
import Llaves from "./Pages/Llaves";
import AdminLogin from "./Pages/AdminLogin";
import Dashboard from "./Pages/Dashboard";
import ProtectedRoute from "./Pages/ProtectedRoute";
import Equipos from "./Pages/Equipos";
import RacksView from "./Pages/RacksView";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/instalaciones/:id" element={<Instalaciones />} />
        <Route path="/llaves" element={<Llaves />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/dashboard" element={<ProtectedRoute> <Dashboard /></ProtectedRoute>} />
        <Route path="/equipos" element={<Equipos />} />
        <Route path="/racks" element={<RacksView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
