import { useCallback, useEffect, useState } from 'react';
import { db, msg, ago } from '../../lib/req';
import { Notice, Pill, sel, btn } from '../../components/ReqBits';
import { useNow, left, passLink } from '../../components/PassBits';

const LV = ['LG', 'B1', 'B2', 'B3', 'B4'];
const BAY = { free: 'bg-emerald-400', reserved: 'bg-amber-400', occupied: 'bg-slate-600', blocked: 'bg-red-300' };

export default function ParkingOps() {
  const now = useNow();
  const [bays, setBays] = useState([]);
  const [reqs, setReqs] = useState(null);
  const [vt, setVt] = useState('car');
  const [pick, setPick] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      db.from('parking_bays').select('id,code,level,vtype,zone,status').limit(1000),
      db.from('parking_requests').select('*, bay:parking_bays!bay_id(code,level), who:profiles!requester_id(full_name), tn:tenants!tenant_id(name), pass:passes!pass_id(token,valid_to)')
        .order('created_at', { ascending: false }).limit(60),
    ]);
    if (a.error || b.error) setErr(msg(a.error || b.error)); else { setBays(a.data); setReqs(b.data); }
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('pops-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_bays' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const act = async (okm, fn) => {
    setErr(''); setOk('');
    const { error } = await fn();
    if (error) setErr(msg(error)); else { setOk(okm); load(); }
  };
  const freeFor = (r) => bays
    .filter((b) => b.status === 'free' && b.vtype === r.vtype && b.zone === (r.is_visitor ? 'visitor' : 'tenant'))
    .sort((x, y) => LV.indexOf(x.level) - LV.indexOf(y.level) || x.code.localeCompare(y.code)).slice(0, 40);

  const waiting = (reqs || []).filter((r) => r.status === 'requested');
  const active = (reqs || []).filter((r) => ['allocated', 'parked'].includes(r.status));
  const inType = bays.filter((b) => b.vtype === vt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-slate-900">Parking desk</h1><p className="text-sm text-slate-500">Allocate bays, watch entry QRs and keep the map live</p></div>
        <button className={btn('ghost')} onClick={() => act('Expiry check finished', async () => { const r = await db.rpc('expire_sweep'); return r; })}>Run expiry check</button>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-700">{'Live bay map · ' + inType.filter((b) => b.status === 'free').length + ' of ' + inType.length + ' free'}</div>
          <div className="flex gap-2">{['car', 'bike'].map((k) => <button key={k} onClick={() => setVt(k)} className={'rounded-full border px-3 py-1 text-xs ' + (vt === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600')}>{k}</button>)}</div>
        </div>
        <div className="space-y-2">
          {LV.map((lv) => {
            const row = inType.filter((b) => b.level === lv).sort((a, b) => a.code.localeCompare(b.code));
            if (!row.length) return null;
            return (
              <div key={lv} className="flex items-start gap-3">
                <div className="w-8 pt-0.5 text-xs font-semibold text-slate-500">{lv}</div>
                <div className="flex flex-1 flex-wrap gap-1">{row.map((b) => <span key={b.id} title={b.code + ' · ' + b.zone + ' · ' + b.status} className={'h-4 w-4 rounded-sm ' + BAY[b.status]} />)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {Object.entries(BAY).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className={'h-3 w-3 rounded-sm ' + c} />{k}</span>)}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{'Waiting for a bay (' + waiting.length + ')'}</h2>
        <div className="space-y-2">
          {waiting.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-slate-900">{r.vehicle_no}</span><Pill cls="bg-slate-100 text-slate-600">{r.vtype}</Pill>{r.is_visitor && <Pill cls="bg-violet-100 text-violet-700">Visitor</Pill>}</div>
                <div className="text-xs text-slate-500">{[r.who?.full_name, r.tn?.name, ago(r.created_at)].filter(Boolean).join(' · ')}</div>
              </div>
              <select className={sel} value={pick[r.id] || ''} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}>
                <option value="">Auto (best bay)</option>
                {freeFor(r).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </select>
              <button className={btn()} onClick={() => act('Bay allocated - the QR is valid for 15 minutes', () => db.rpc('allocate_parking', { p_request: r.id, p_bay: pick[r.id] || null }))}>Allocate</button>
              <button className={btn('danger')} onClick={() => act('Request declined', () => db.rpc('reject_parking', { p_request: r.id, p_reason: 'No bay available right now' }))}>Decline</button>
            </div>
          ))}
          {reqs && !waiting.length && <p className="text-sm text-slate-500">No requests waiting.</p>}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{'Reserved and parked (' + active.length + ')'}</h2>
        <div className="space-y-2">
          {active.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <span className="font-mono font-semibold text-slate-900">{r.vehicle_no}</span>
                <span className="ml-2 text-sm text-slate-600">{r.bay ? 'Bay ' + r.bay.code : ''}</span>
                <div className="text-xs text-slate-500">{[r.who?.full_name, r.tn?.name].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === 'allocated' && r.pass && <span className="text-xs font-medium text-amber-700">{'QR ' + (left(r.pass.valid_to, now) === 'expired' ? 'expired' : left(r.pass.valid_to, now) + ' left')}</span>}
                <Pill cls={r.status === 'parked' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}>{r.status === 'parked' ? 'Parked' : 'Reserved'}</Pill>
                {r.pass && <a className="text-xs text-blue-600 underline" href={passLink(r.pass.token)} target="_blank" rel="noreferrer">Pass</a>}
              </div>
            </div>
          ))}
          {reqs && !active.length && <p className="text-sm text-slate-500">Nothing reserved or parked.</p>}
        </div>
      </div>
    </div>
  );
}