import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { navFor } from '../config/nav';
import { PORTALS } from '../config/roles';
import NotificationBell from './NotificationBell';

export default function AppShell({ children }) {
  const { profile, signOut, returnTo, returnToAdmin } = useAuth();
  const navigate = useNavigate();
  const portal = PORTALS.find((p) => p.id === profile.portal);
  const items = navFor(profile);

  const back = async () => { await returnToAdmin(); navigate('/admin'); };
  const out = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen flex flex-col">
      {returnTo && (
        <div className="bg-amber-400 text-amber-950 text-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>Viewing as <b>{profile.full_name}</b> ({profile.role_code} · {portal?.label})</span>
          <button onClick={back} className="rounded-md bg-amber-950 text-amber-50 px-3 py-1 text-xs font-semibold hover:bg-black">← Return to Admin</button>
        </div>
      )}
      <header className="bg-blue-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-bold">A</div>
            <div className="leading-tight min-w-0">
              <div className="font-bold tracking-wide text-sm">ATLURI ASCEND</div>
              <div className="text-[11px] text-blue-200 truncate">{portal?.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium">{profile.full_name}</div>
              <div className="text-[11px] text-blue-200">{profile.role_code}{profile.team ? ` · ${profile.team}` : ''}</div>
            </div>
            <button onClick={out} className="ml-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4 flex gap-1 overflow-x-auto">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) => `px-3 py-2 text-sm whitespace-nowrap border-b-2 ${isActive ? 'border-white text-white' : 'border-transparent text-blue-200 hover:text-white'}`}>
              {i.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}