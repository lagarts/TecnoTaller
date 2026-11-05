import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Taller from './pages/Taller';
import Reportes from './pages/Reportes';
import Informes from './pages/Informes';
import Ordenes from './pages/taller/Ordenes';
import Presupuesto from './pages/taller/Presupuesto';
import Calendario from './pages/taller/Calendario';
import Recordatorios from './pages/taller/Recordatorios';
import Vehiculos from './pages/taller/Vehiculos';
import Historico from './pages/taller/Historico';
import Tienda from './pages/Tienda';
import Caja from './pages/Caja';
import CuentaCorrientes from './pages/CuentaCorrientes';
import Inventario from './pages/Inventario';
import Trabajadores from './pages/Trabajadores';
import Contactos from './pages/Contactos';
import HistorialCaja from './pages/reportes/HistorialCaja';
import VentaMensual from './pages/reportes/VentaMensual';
import VentaAnual from './pages/reportes/VentaAnual';
import VentaDividida from './pages/reportes/VentaDividida';
import HistoricoCliente from './pages/informes/HistoricoCliente';
import HistoricoVehiculo from './pages/informes/HistoricoVehiculo';
import HistoricoDetalladoVehiculo from './pages/informes/HistoricoDetalladoVehiculo';
import Herramientas from './pages/Herramientas';
import Configuracion from './pages/Configuracion';
import MiCuenta from './pages/MiCuenta';
import AdminPanel from './pages/AdminPanel';
import ReservarTurno from './pages/public/ReservarTurno';
import HistorialPatente from './pages/public/HistorialPatente';
import PortalCliente from './pages/public/PortalCliente';
import MisPagos from './pages/trabajador/MisPagos';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/inicio" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/registro" element={<PublicRoute><Register /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="inicio" element={<Dashboard />} />
        <Route path="taller" element={<Taller />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="informes" element={<Informes />} />
        <Route path="taller/ordenes" element={<Ordenes />} />
        <Route path="taller/presupuesto" element={<Presupuesto />} />
        <Route path="taller/calendario" element={<Calendario />} />
        <Route path="taller/recordatorios" element={<Recordatorios />} />
        <Route path="taller/vehiculos" element={<Vehiculos />} />
        <Route path="taller/historico" element={<Historico />} />
        <Route path="tienda" element={<Tienda />} />
        <Route path="caja" element={<Caja />} />
        <Route path="cuenta-corrientes" element={<CuentaCorrientes />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="trabajadores" element={<Trabajadores />} />
        <Route path="clientes" element={<Contactos />} />
        <Route path="reportes/historial-caja" element={<HistorialCaja />} />
        <Route path="reportes/venta-mensual" element={<VentaMensual />} />
        <Route path="reportes/venta-anual" element={<VentaAnual />} />
        <Route path="reportes/venta-dividida" element={<VentaDividida />} />
        <Route path="informes/historico-cliente" element={<HistoricoCliente />} />
        <Route path="informes/historico-vehiculo" element={<HistoricoVehiculo />} />
        <Route path="informes/historico-detallado-vehiculo" element={<HistoricoDetalladoVehiculo />} />
        <Route path="herramientas" element={<Herramientas />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="mi-cuenta" element={<MiCuenta />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="cobros/mis-cobros" element={<MisPagos />} />
      </Route>

      <Route path="/portal/:userId" element={<PortalCliente />} />
      <Route path="/reservar/:userId" element={<ReservarTurno />} />
      <Route path="/historial" element={<HistorialPatente />} />

      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
