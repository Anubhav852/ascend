import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import HandoffPanel from './components/HandoffPanel';
import EmergencyOverlay from './components/EmergencyOverlay';
import { FullPageSpinner } from './components/ui';
import Login from './pages/Login';
import Pass from './pages/Pass';
import PanelEntry from './pages/PanelEntry';
import Billing from './pages/Billing';
import PortalHome from './pages/PortalHome';
import OrderQueue from './pages/OrderQueue';
import Dashboard from './pages/admin/Dashboard';
import UserPortals from './pages/admin/UserPortals';
import AllRequests from './pages/admin/AllRequests';
import BuildingView from './pages/admin/BuildingView';
import Analytics from './pages/admin/Analytics';
import AuditLog from './pages/admin/AuditLog';
import RolesMatrix from './pages/admin/RolesMatrix';
import Compliance from './pages/admin/Compliance';
import AdminMore from './pages/admin/AdminMore';
import FoodMenu from './pages/tenant/FoodMenu';
import MyOrders from './pages/tenant/MyOrders';
import RequestAnything from './pages/tenant/RequestAnything';
import MyRequests from './pages/tenant/MyRequests';
import Sos from './pages/tenant/Sos';
import Parking from './pages/tenant/Parking';
import Visitors from './pages/tenant/Visitors';
import Bookings from './pages/tenant/Bookings';
import WorkQueue from './pages/staff/WorkQueue';
import Parcels from './pages/staff/Parcels';
import Stock from './pages/staff/Stock';
import ParkingOps from './pages/staff/ParkingOps';
import Reception from './pages/staff/Reception';
import Gate from './pages/staff/Gate';
import Events from './pages/staff/Events';
import Devices from './pages/staff/Devices';
import WorkOrders from './pages/vendor/WorkOrders';
import MenuManager from './pages/outlet/MenuManager';

function HomeRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={`/${profile.portal}`} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pass/:token" element={<Pass />} />
        <Route path="/panel" element={<PanelEntry />} />

        <Route element={<ProtectedRoute portal="tenant" />}>
          <Route path="/tenant" element={<PortalHome />} />
          <Route path="/tenant/requests/new" element={<RequestAnything />} />
          <Route path="/tenant/requests" element={<MyRequests />} />
          <Route path="/tenant/sos" element={<Sos />} />
          <Route path="/tenant/food" element={<FoodMenu />} />
          <Route path="/tenant/orders" element={<MyOrders />} />
          <Route path="/tenant/parking" element={<Parking />} />
          <Route path="/tenant/visitors" element={<Visitors />} />
          <Route path="/tenant/bookings" element={<Bookings />} />
          <Route path="/tenant/billing" element={<Billing />} />
        </Route>

        <Route element={<ProtectedRoute portal="staff" />}>
          <Route path="/staff" element={<PortalHome />} />
          <Route path="/staff/queue" element={<WorkQueue />} />
          <Route path="/staff/orders" element={<OrderQueue />} />
          <Route path="/staff/parcels" element={<Parcels />} />
          <Route path="/staff/stock" element={<Stock />} />
          <Route path="/staff/parking" element={<ParkingOps />} />
          <Route path="/staff/reception" element={<Reception />} />
          <Route path="/staff/gate" element={<Gate />} />
          <Route path="/staff/events" element={<Events />} />
          <Route path="/staff/devices" element={<Devices />} />
        </Route>

        <Route element={<ProtectedRoute portal="outlet" />}>
          <Route path="/outlet" element={<PortalHome />} />
          <Route path="/outlet/orders" element={<OrderQueue />} />
          <Route path="/outlet/menu" element={<MenuManager />} />
          <Route path="/outlet/stock" element={<Stock />} />
        </Route>

        <Route element={<ProtectedRoute portal="vendor" />}>
          <Route path="/vendor" element={<PortalHome />} />
          <Route path="/vendor/work" element={<WorkOrders />} />
        </Route>

        <Route element={<ProtectedRoute portal="admin" />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/portals" element={<UserPortals />} />
          <Route path="/admin/requests" element={<AllRequests />} />
          <Route path="/admin/orders" element={<OrderQueue />} />
          <Route path="/admin/devices" element={<Devices />} />
          <Route path="/admin/building" element={<BuildingView />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/admin/billing" element={<Billing />} />
          <Route path="/admin/more" element={<AdminMore />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/roles" element={<RolesMatrix />} />
          <Route path="/admin/compliance" element={<Compliance />} />
          <Route path="/admin/parking" element={<ParkingOps />} />
          <Route path="/admin/reception" element={<Reception />} />
          <Route path="/admin/gate" element={<Gate />} />
          <Route path="/admin/events" element={<Events />} />
          <Route path="/admin/stock" element={<Stock />} />
          <Route path="/admin/parcels" element={<Parcels />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <HandoffPanel />
      <EmergencyOverlay />
    </>
  );
}