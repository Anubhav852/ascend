import { useCallback, useEffect, useState } from 'react';
import { db, useAuth, msg } from '../../lib/req';
import { Notice, Pill, inp, sel, btn } from '../../components/ReqBits';
import { PassQR, passLink, useNow, left, when } from '../../components/PassBits';

const ST = {
  requested: ['Waiting for the parking desk', 'bg-blue-100 text-blue-700'],
  allocated: ['Bay reserved', 'bg-emerald-100 text-emerald-700'],
  parked: ['Parked', 'bg-indigo-100 text-indigo-700'],
  exited: ['Exited', 'bg-slate-100 text-slate-600'],
  expired: ['QR expired, bay released', 'bg-amber-100 text-amber-800'],
  rejected: ['Declined', 'bg-rose-100 text-rose-700'],
};

export default function Parking() {
  const { profile } = useAuth();
  const now = useNow();
  const [rows, setRows] = useState(null);
  const [tn, setTn] = useState(null);
  const [vehicle, setVehicle] = useState('');
  const [vtype, setVtype] = useState('car');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await db.from('parking_requests')
      .select('*, bay:parking_bays!bay_id(code,level,zone), pass:passes!pass_id(token,valid_to,status,uses)')
      .eq('requester_id', profile.id).order('created_at', { ascending: false }).limit(20);
    if (error) setErr(msg(error)); else setRows(data);
  }, [profile]);

  useEffect(() => {
    load();
    if (profile?.tenant_id) db.from('tenants').select('name,parking_quota').eq('id', profile.tenant_id).maybeSingle().then(({ data }) => setTn(data));
    const ch = db.channel('park-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [load, profile]);

  const request = async () => {
    setBusy(true); setErr(''); setOk('');
    const { error } = await db.rpc('request_parking', { p_vehicle: vehicle.trim(), p_vtype: vtype });
    setBusy(false);
    if (error) return setErr(msg(error));
    setOk('Request sent to the parking desk'); setVehicle(''); load();
  };
  const cancel = async (r) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('set_ticket_status', { p_ticket: r.ticket_id, p_status: 'cancelled', p_note: null });
    if (error) setErr(msg(error)); else { setOk('Request cancelled'); load(); }
  };

  const used = (rows || []).filter((r) => !r.is_visitor && ['requested', 'allocated', 'parked'].includes(r.status)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Parking</h1>
        <p className="text-sm text-slate-500">
          {tn ? tn.name + ' has a quota of ' + tn.parking_quota + ' bays · you are using ' + used : 'Request a bay and get an entry QR valid for 15 minutes'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input className={inp + ' min-w-0 flex-1 uppercase'} placeholder="Vehicle number, e.g. TS09AB1234" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <select className={sel} value={vtype} onChange={(e) => setVtype(e.target.value)}><option value="car">Car</option><option value="bike">Bike</option></select>
        <button className={btn()} disabled={busy || vehicle.trim().length < 4} onClick={request}>Request a bay</button>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      {rows === null && <p className="text-sm text-slate-500">Loading...</p>}
      <div className="space-y-3">
        {(rows || []).map((r) => {
          const [lab, cls] = ST[r.status] || [r.status, 'bg-slate-100 text-slate-600'];
          const live = r.status === 'allocated' && r.pass;
          const t = live ? left(r.pass.valid_to, now) : '';
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              {live && t !== 'expired' && <PassQR token={r.pass.token} size={96} />}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold text-slate-900">{r.vehicle_no}</span>
                  <Pill cls={cls}>{lab}</Pill>
                  {r.is_visitor && <Pill cls="bg-violet-100 text-violet-700">Visitor bay</Pill>}
                  <span className="text-xs text-slate-400">{r.vtype}</span>
                </div>
                {r.bay && <div className="text-sm text-slate-600">{'Bay ' + r.bay.code + ' · level ' + r.bay.level}</div>}
                {live && <div className={'text-sm font-medium ' + (t === 'expired' ? 'text-red-600' : 'text-emerald-700')}>{t === 'expired' ? 'Entry QR expired, the bay will be released' : 'Enter within ' + t}</div>}
                {live && <a className="text-xs text-blue-600 underline" href={passLink(r.pass.token)} target="_blank" rel="noreferrer">Open pass page</a>}
                {r.status === 'parked' && r.entered_at && <div className="text-xs text-slate-500">{'Entered ' + when(r.entered_at)}</div>}
              </div>
              {['requested', 'allocated'].includes(r.status) && <button className={btn('ghost')} onClick={() => cancel(r)}>Cancel</button>}
            </div>
          );
        })}
        {rows && !rows.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No parking requests yet.</p>}
      </div>
    </div>
  );
}