import { useCallback, useEffect, useState } from 'react';
import { db, msg } from '../../lib/req';
import { Notice, Pill, inp, btn } from '../../components/ReqBits';
import { PassQR, passLink, when, localInput } from '../../components/PassBits';

const ST = {
  invited: ['Invited', 'bg-blue-100 text-blue-700'],
  pending_approval: ['Needs your approval', 'bg-amber-100 text-amber-800'],
  approved: ['Pass issued', 'bg-emerald-100 text-emerald-700'],
  arrived: ['On site', 'bg-indigo-100 text-indigo-700'],
  departed: ['Left', 'bg-slate-100 text-slate-600'],
  denied: ['Declined', 'bg-rose-100 text-rose-700'],
  expired: ['Expired', 'bg-slate-100 text-slate-500'],
};
const blank = () => ({ name: '', phone: '', purpose: '', floor: '', from: localInput(new Date()), to: localInput(new Date(Date.now() + 4 * 3600e3)), parking: false, vehicle: '' });
const lbl = 'mb-1 block text-sm font-medium text-slate-700';

export default function Visitors() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(blank());
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setF({ ...f, [k]: v });

  const load = useCallback(async () => {
    const { data, error } = await db.from('visitors')
      .select('*, pass:passes!pass_id(token,status,valid_to,uses,max_uses), host:profiles!host_id(full_name)')
      .order('created_at', { ascending: false }).limit(40);
    if (error) setErr(msg(error)); else setRows(data);
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('vis-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const invite = async () => {
    setBusy(true); setErr(''); setOk('');
    const { error } = await db.rpc('invite_visitor', {
      p_name: f.name.trim(), p_phone: f.phone.trim() || null, p_purpose: f.purpose.trim() || null,
      p_from: new Date(f.from).toISOString(), p_to: new Date(f.to).toISOString(), p_floor: f.floor.trim() || null,
      p_parking: f.parking, p_vehicle: f.parking ? (f.vehicle.trim() || null) : null,
    });
    setBusy(false);
    if (error) return setErr(msg(error));
    setOk('Visitor invited - the QR pass is ready below' + (f.parking ? ' · a visitor bay was requested' : '')); setF(blank()); load();
  };
  const decide = async (v, yes) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('decide_walkin', { p_visitor: v.id, p_approve: yes });
    if (error) setErr(msg(error)); else { setOk(yes ? 'Approved - a limited pass was issued' : 'Declined'); load(); }
  };

  const pending = (rows || []).filter((v) => v.status === 'pending_approval');

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visitors</h1>
        <p className="text-sm text-slate-500">Invite guests with a QR pass, and approve walk-ins from reception</p>
      </div>
      {pending.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <div><div className="font-semibold text-amber-900">{v.name + ' is at reception'}</div><div className="text-sm text-amber-800">{v.purpose || 'Walk-in visit'}</div></div>
          <div className="flex gap-2"><button className={btn('good')} onClick={() => decide(v, true)}>Approve</button><button className={btn('danger')} onClick={() => decide(v, false)}>Decline</button></div>
        </div>
      ))}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">Invite a visitor</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Visitor name</label><input className={inp} value={f.name} onChange={(e) => up('name', e.target.value)} /></div>
          <div><label className={lbl}>Phone</label><input className={inp} value={f.phone} onChange={(e) => up('phone', e.target.value)} /></div>
          <div><label className={lbl}>Purpose</label><input className={inp} value={f.purpose} onChange={(e) => up('purpose', e.target.value)} placeholder="e.g. Client meeting" /></div>
          <div><label className={lbl}>Floor</label><input className={inp} value={f.floor} onChange={(e) => up('floor', e.target.value)} placeholder="e.g. 4" /></div>
          <div><label className={lbl}>From</label><input type="datetime-local" className={inp} value={f.from} onChange={(e) => up('from', e.target.value)} /></div>
          <div><label className={lbl}>Until</label><input type="datetime-local" className={inp} value={f.to} onChange={(e) => up('to', e.target.value)} /></div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.parking} onChange={(e) => up('parking', e.target.checked)} /> Reserve a visitor parking bay</label>
        {f.parking && <input className={inp + ' mt-2 uppercase'} placeholder="Visitor vehicle number" value={f.vehicle} onChange={(e) => up('vehicle', e.target.value)} />}
        <div className="mt-3"><Notice>{err}</Notice><Notice kind="ok">{ok}</Notice></div>
        <button className={btn() + ' mt-3'} disabled={busy || !f.name.trim()} onClick={invite}>{busy ? 'Sending...' : 'Invite and issue pass'}</button>
      </div>
      <div className="space-y-3">
        {rows === null && <p className="text-sm text-slate-500">Loading...</p>}
        {(rows || []).map((v) => {
          const [lab, cls] = ST[v.status] || [v.status, 'bg-slate-100 text-slate-600'];
          const live = v.pass && ['approved', 'arrived'].includes(v.status);
          return (
            <div key={v.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              {live && <PassQR token={v.pass.token} size={84} />}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{v.name}</span><Pill cls={cls}>{lab}</Pill>{v.kind === 'walk_in' && <Pill cls="bg-violet-100 text-violet-700">Walk-in</Pill>}</div>
                <div className="text-sm text-slate-600">{[v.purpose, v.floor && 'Floor ' + v.floor, v.host?.full_name && 'Host ' + v.host.full_name].filter(Boolean).join(' · ')}</div>
                {v.expected_from && <div className="text-xs text-slate-500">{when(v.expected_from) + ' to ' + when(v.expected_to)}</div>}
                {v.arrived_at && <div className="text-xs text-slate-500">{'Arrived ' + when(v.arrived_at)}</div>}
                {live && <a className="text-xs text-blue-600 underline" href={passLink(v.pass.token)} target="_blank" rel="noreferrer">Open pass page</a>}
              </div>
            </div>
          );
        })}
        {rows && !rows.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No visitors yet.</p>}
      </div>
    </div>
  );
}