import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES, PORTALS, emailFor } from '../config/roles';
import { Button, Card, FullPageSpinner } from '../components/ui';
import { missingEnv } from '../lib/supabase';

export default function Login() {
  const { session, profile, loading, signIn, DEMO_PASSWORD } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (loading) return <FullPageSpinner />;
  if (session && profile) return <Navigate to={`/${profile.portal}`} replace />;

  const go = async (e, p) => {
    setBusy(true); setErr('');
    const { error } = await signIn(e, p);
    setBusy(false);
    if (error) setErr(error.message + ' — if this is a demo account, make sure `npm run seed-users` has been run.');
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="text-center text-white mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-xl font-bold">A</div>
          <h1 className="mt-3 text-3xl font-bold tracking-wide">ATLURI ASCEND</h1>
          <p className="text-blue-200 text-sm mt-1">Your Rise, Our Space · Smart building platform demo</p>
        </div>

        {missingEnv && (
          <div className="mb-4 rounded-lg bg-red-100 text-red-800 text-sm p-3">
            Supabase keys missing. Fill <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> and restart <code>npm run dev</code>.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1 h-fit">
            <h2 className="font-semibold text-lg mb-4">Sign in</h2>
            <form onSubmit={(e) => { e.preventDefault(); go(email.trim(), password); }} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="t2@ascend-demo.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={DEMO_PASSWORD}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {err && <div className="text-xs text-red-600">{err}</div>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
            </form>
            <p className="mt-4 text-xs text-slate-500">All demo accounts use <b>{DEMO_PASSWORD}</b>. Or pick a role on the right for one-click login.</p>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <h2 className="font-semibold text-lg mb-1">Quick demo login</h2>
            <p className="text-xs text-slate-500 mb-4">One account per role. Same ticket engine, different configuration.</p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {PORTALS.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-sm font-semibold">{p.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.filter((r) => r.portal === p.id).map((r) => (
                      <button key={r.code} disabled={busy} onClick={() => go(emailFor(r.code), DEMO_PASSWORD)}
                        title={`${r.full_name} · ${r.label}`}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50">
                        <b className="text-blue-700">{r.code}</b> <span className="text-slate-600">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}