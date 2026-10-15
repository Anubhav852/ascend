import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/req';
import { PassQR, useNow, left, when } from '../components/PassBits';

const KIND = { visitor: 'Visitor pass', parking: 'Parking pass', food_delivery: 'Food delivery pass', vendor: 'Vendor work pass', event: 'Event pass', parcel: 'Parcel pass' };
const HINT = {
  visitor: 'Show this QR at the gate. Scan again when you leave.',
  parking: 'Show this QR at the entry barrier. Scan again on exit.',
  food_delivery: 'Hand the order over at the handover point only.',
  vendor: 'Carry your permit. Work is allowed in the area below only.',
};

export default function Pass() {
  const { token } = useParams();
  const now = useNow();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.rpc('get_pass_public', { p_token: token });
    if (error) setErr(error.message); else { setErr(''); setP(data); }
  }, [token]);
  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [load]);

  const wrap = (body) => (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-widest text-blue-700">ATLURI</div>
          <div className="text-xl font-bold tracking-wide text-blue-900">ASCEND</div>
        </div>
        {body}
        <p className="text-center text-xs text-slate-400">Entry is recorded by building security. This pass never replaces emergency exits.</p>
      </div>
    </div>
  );

  if (!p) return wrap(<p className="text-center text-sm text-slate-500">{err || 'Loading pass...'}</p>);
  if (!p.found) return wrap(<div className="rounded-2xl bg-white p-6 text-center shadow"><div className="text-3xl">❓</div><div className="mt-2 font-semibold text-slate-800">Pass not found</div></div>);

  const live = p.status === 'active';
  const inside = live && p.kind === 'parking' && p.uses > 0;
  const banner = live ? (inside ? ['VEHICLE INSIDE', 'bg-indigo-600'] : ['VALID', 'bg-emerald-600'])
    : p.status === 'expired' ? ['EXPIRED', 'bg-amber-500'] : p.status === 'used' ? ['USED', 'bg-slate-600'] : ['CLOSED', 'bg-red-600'];
  const d = p.detail || {};
  const rows = [
    ['Holder', p.holder], ['Zone', p.zone], ['Host', p.host],
    ['Bay', d.bay && d.bay + (d.level ? ' (' + d.level + ')' : '')], ['Vehicle', d.vehicle], ['Deliver to', d.deliver_to],
    ['Permit', d.permit], ['Work order', d.work_order && d.work_order.replace('TKT-', 'REQ-')],
    ['Valid from', when(p.valid_from)], ['Valid until', inside ? 'Until you exit' : when(p.valid_to)], ['Scans', p.uses + ' of ' + p.max_uses],
  ].filter((r) => r[1]);

  return wrap(
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
      <div className={'px-4 py-3 text-center text-lg font-bold tracking-wide text-white ' + banner[1]}>{banner[0]}</div>
      <div className="space-y-4 p-5">
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-500">{KIND[p.kind] || 'Pass'}</div>
          {live && !inside && <div className="mt-1 text-3xl font-bold text-slate-900">{left(p.valid_to, now)}<span className="text-base font-medium text-slate-400"> left</span></div>}
        </div>
        {live && <div className="text-center"><PassQR token={p.token} size={180} /></div>}
        {live && HINT[p.kind] && <p className="text-center text-sm text-slate-600">{HINT[p.kind]}</p>}
        {!live && <p className="text-center text-sm text-slate-600">This pass can no longer be used. Contact reception if you need a new one.</p>}
        <dl className="divide-y divide-slate-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-800">{v}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}