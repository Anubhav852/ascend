import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES, PORTALS, PASS_VIEWS } from '../../config/roles';
import { Card, PageHeader, Badge } from '../../components/ui';

export default function UserPortals() {
  const { openAs } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  const open = async (code) => {
    setBusy(code); setErr('');
    const { error } = await openAs(code);
    setBusy(null);
    if (error) setErr(`Could not open ${code}: ${error.message}`);
    else navigate('/');
  };

  const match = (r) => !q || `${r.code} ${r.label} ${r.full_name}`.toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <PageHeader title="User Portals"
        subtitle="Click any role to open its portal as that user. A banner lets you return to Admin."
        actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role or name…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500" />} />
      {err && <div className="mb-4 rounded-lg bg-red-100 text-red-800 text-sm p-3">{err}</div>}

      <div className="space-y-5">
        {PORTALS.map((p) => {
          const roles = ROLES.filter((r) => r.portal === p.id);
          const shown = roles.filter(match);
          if (!shown.length) return null;
          return (
            <Card key={p.id} className="overflow-hidden">
              <div className="px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2" style={{ background: p.color }}>
                <div>
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-xs text-white/80">{p.blurb}</div>
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">{roles.length} roles</span>
              </div>
              <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((r) => (
                  <button key={r.code} onClick={() => open(r.code)} disabled={!!busy}
                    className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60 transition">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{r.label}</span>
                      <Badge tone="blue">{r.code}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{busy === r.code ? 'Opening…' : r.full_name}</div>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}

        <Card className="p-4">
          <div className="font-semibold">Pass-only experiences <span className="text-xs font-normal text-slate-400">(no login — public QR pass page, Slice 5)</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PASS_VIEWS.map((v) => (
              <span key={v.code} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500">
                <b>{v.code}</b> {v.label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}