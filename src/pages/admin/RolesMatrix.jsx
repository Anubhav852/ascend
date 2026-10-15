import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, useAuth, msg } from '../../lib/req';
import { ROLES, PORTALS, TEAMS } from '../../config/roles';
import { navFor } from '../../config/nav';
import { Notice, Pill, sel, btn } from '../../components/ReqBits';

const scopeOf = (r) => r.portal === 'admin' ? 'Building-wide' : r.portal === 'staff' ? TEAMS[r.team] : r.portal === 'outlet' ? r.outlet_id : r.portal === 'vendor' ? r.vendor_id : (r.tenant_id || 'No tenant yet');
const seesOf = (r) => r.portal === 'admin' ? 'Everything' : r.portal === 'staff' ? 'Requests routed to ' + TEAMS[r.team]
  : r.portal === 'outlet' ? 'Requests for its own outlet' : r.portal === 'vendor' ? 'Only work orders sent to its company'
  : r.code === 'T1' ? 'Own requests and the whole company' : 'Only own requests';
const COLOR = { tenant: 'bg-blue-100 text-blue-700', staff: 'bg-sky-100 text-sky-700', outlet: 'bg-indigo-100 text-indigo-700', vendor: 'bg-violet-100 text-violet-700', admin: 'bg-slate-800 text-white' };

export default function RolesMatrix() {
  const { profile } = useAuth();
  const [prof, setProf] = useState({});
  const [portal, setPortal] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.from('profiles').select('id,role_code,active');
    if (error) return setErr(msg(error));
    const m = {}; data.forEach((p) => { m[p.role_code] = p; }); setProf(m);
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => ROLES.filter((r) => (!portal || r.portal === portal)
    && (!text.trim() || (r.code + ' ' + r.label + ' ' + r.full_name).toLowerCase().includes(text.trim().toLowerCase()))), [portal, text]);

  const toggle = async (r) => {
    const p = prof[r.code];
    setErr(''); setOk('');
    const { error } = await db.from('profiles').update({ active: !p.active }).eq('id', p.id);
    if (error) return setErr(msg(error));
    setOk(r.code + (p.active ? ' suspended' : ' re-activated')); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Roles and access matrix</h1>
          <p className="text-sm text-slate-500">{ROLES.length + ' roles. Pages come from the nav config. Visibility is enforced by the database, not the screen.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={portal} onChange={(e) => setPortal(e.target.value)}><option value="">All portals</option>{PORTALS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          <input className={sel + ' w-48'} placeholder="Search..." value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Role</th><th className="p-3">Portal</th><th className="p-3">Scope</th><th className="p-3">Can see</th><th className="p-3">Pages</th><th className="p-3">Account</th></tr></thead>
          <tbody>
            {list.map((r) => {
              const p = prof[r.code];
              const locked = !p || p.id === profile?.id || r.code === 'M1';
              const pages = navFor({ portal: r.portal, team: r.team, role_code: r.code }).map((n) => n.label).join(', ');
              return (
                <tr key={r.code} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold text-blue-700">{r.code}</td>
                  <td className="p-3"><div className="font-medium text-slate-900">{r.label}</div><div className="text-xs text-slate-500">{r.full_name}</div></td>
                  <td className="p-3"><Pill cls={COLOR[r.portal]}>{r.portal}</Pill></td>
                  <td className="p-3 text-slate-600">{scopeOf(r)}</td>
                  <td className="p-3 text-slate-600">{seesOf(r)}</td>
                  <td className="max-w-xs p-3 text-xs text-slate-500">{pages}</td>
                  <td className="p-3">{p ? <button disabled={locked} onClick={() => toggle(r)} className={btn(p.active ? 'ghost' : 'good') + ' !px-2 !py-1 !text-xs'}>{p.active ? 'Active · suspend' : 'Suspended · activate'}</button> : <span className="text-xs text-slate-400">no account</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">M1 and your own account cannot be suspended here. Pass-only roles V1 to V6 have no login and use the public pass page.</p>
    </div>
  );
}