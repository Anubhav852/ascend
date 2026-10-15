import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, Button } from './ui';
import AppShell from './AppShell';

export default function ProtectedRoute({ portal }) {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-lg font-semibold">No profile found for this account</div>
        <div className="text-sm text-slate-500">Run <code className="bg-slate-100 px-1 rounded">npm run seed-users</code> and try again.</div>
        <Button onClick={signOut}>Sign out</Button>
      </div>
    );
  }
  if (portal && profile.portal !== portal) return <Navigate to={`/${profile.portal}`} replace />;
  return <AppShell><Outlet /></AppShell>;
}