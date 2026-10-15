import { useCallback, useEffect, useState } from 'react';
import { db, msg } from '../../lib/req';
import { Notice, Pill, inp, sel, btn } from '../../components/ReqBits';
import { PassQR, passLink, when } from '../../components/PassBits';

const ST = {
  invited: ['Invited', 'bg-blue-100 text-blue-700'], pending_approval: ['Waiting for host', 'bg-amber-100 text-amber-800'],
  approved: ['Pass issued', 'bg-emerald-100 text-emerald-700'], arrived: ['On site', 'bg-indigo-100 text-indigo-700'],
  departed: ['Left', 'bg-slate-100 text-slate-600'], denied: ['Declined', 'bg-rose-100 text-rose-700'], expired: ['Expired', 'bg-slate-100 text-slate-500'],
};

export default function Reception() {
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', purpose: '', host: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setF({ ...f, [k]: v });

  const load = useCallback(async () => {
    const { data, error } = await db.from('visitors')
      .select('*, host:profiles!host_id(full_name), tn:tenants!tenant_id(name), pass:passes!pass_id(token,status,uses)')
      .order('created_at', { ascending: false }).limit(50);
    if (error) setErr(msg(error)); else setRows(data);
  }, []);
  useEffect(() => {
    db.from('profiles').select('id,full_name,role_code,tn:tenants!tenant_id(name)').eq('portal', 'tenant').not('tenant_id', 'is', null).order('full_name')
      .then(({ data }) => setPeople(data || []));
    load();
    const ch = db.channel('recep-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const register = async () => {
    setBusy(true); setErr(''); setOk('');
    const { error } = await db.rpc('register_walkin', { p_name: f.name.trim(), p_phone: f.phone.trim() || null, p_purpose: f.purpose.trim() || null, p_host: f.host });
    setBusy(false);
    if (error) return setErr(msg(error));
    setOk('Walk-in registered - the host has been asked to approve'); setF({ name: '', phone: '', purpose: '', host: '' }); load();
  };

  const count = (s) => (rows || []).filter((v) => s.includes(v.status)).length;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-900">Reception</h1><p className="text-sm text-slate-500">Register walk-ins and see who is expected or on site</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Expected', count(['invited', 'approved'])], ['Waiting for host', count(['pending_approval'])], ['On site now', count(['arrived'])]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-semibold text-slate-900">{v}</div></div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">Register a walk-in</div>
        <div className="flex flex-wrap gap-2">
          <input className={inp + ' min-w-0 flex-1'} placeholder="Visitor name" value={f.name} onChange={(e) => up('name', e.target.value)} />
          <input className={inp + ' w-40'} placeholder="Phone" value={f.phone} onChange={(e) => up('phone', e.target.value)} />
          <input className={inp + ' min-w-0 flex-1'} placeholder="Purpose" value={f.purpose} onChange={(e) => up('purpose', e.target.value)} />
          <select className={sel} value={f.host} onChange={(e) => up('host', e.target.value)}>
            <option value="">Host...</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name + ' · ' + (p.tn?.name || p.role_code)}</option>)}
          </select>
          <button className={btn()} disabled={busy || !f.name.trim() || !f.host} onClick={register}>Register</button>
        </div>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      <div className="space-y-2">
        {rows === null && <p className="text-sm text-slate-500">Loading...</p>}
        {(rows || []).map((v) => {
          const [lab, cls] = ST[v.status] || [v.status, 'bg-slate-100'];
          const live = v.pass && ['approved', 'arrived'].includes(v.status);
          return (
            <div key={v.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
              {live && <PassQR token={v.pass.token} size={64} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{v.name}</span><Pill cls={cls}>{lab}</Pill>{v.kind === 'walk_in' && <Pill cls="bg-violet-100 text-violet-700">Walk-in</Pill>}</div>
                <div className="text-xs text-slate-500">{[v.purpose, 'Host ' + (v.host?.full_name || '-'), v.tn?.name, v.arrived_at && 'Arrived ' + when(v.arrived_at)].filter(Boolean).join(' · ')}</div>
                {live && <a className="text-xs text-blue-600 underline" href={passLink(v.pass.token)} target="_blank" rel="noreferrer">Open pass page</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}