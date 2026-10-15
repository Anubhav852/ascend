import { useCallback, useEffect, useState } from 'react';
import { db, reqRef, ago, msg, OPEN } from '../../lib/req';
import { StatusPill, Notice, inp, sel, btn } from '../../components/ReqBits';

const COURIERS = ['Amazon', 'Flipkart', 'BlueDart', 'Delhivery', 'DTDC', 'Other'];

export default function Parcels() {
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState(null);
  const [rcp, setRcp] = useState('');
  const [courier, setCourier] = useState(COURIERS[0]);
  const [awb, setAwb] = useState('');
  const [pins, setPins] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await db.from('tickets').select('*, who:profiles!requester_id(full_name)')
      .eq('category', 'parcel').order('created_at', { ascending: false }).limit(50);
    if (error) setErr(msg(error)); else setRows(data);
  }, []);

  useEffect(() => {
    db.from('profiles').select('id,full_name,role_code').eq('portal', 'tenant').not('tenant_id', 'is', null).order('full_name')
      .then(({ data }) => setPeople(data || []));
    load();
    const ch = db.channel('parcels-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const register = async () => {
    setBusy(true); setErr(''); setOk('');
    const { data, error } = await db.rpc('register_parcel', { p_recipient: rcp, p_courier: courier, p_awb: awb || null });
    setBusy(false);
    if (error) return setErr(msg(error));
    setOk('Parcel logged · locker ' + (data.meta?.locker || '') + ' · the recipient has been notified with a PIN');
    setRcp(''); setAwb(''); load();
  };
  const collect = async (t) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('collect_parcel', { p_ticket: t.id, p_pin: (pins[t.id] || '').trim() });
    if (error) return setErr(msg(error));
    setOk('Handed over · PIN verified'); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Parcel desk</h1>
        <p className="text-sm text-slate-500">Log arrivals and hand over with the recipient's PIN</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">Log an arriving parcel</div>
        <div className="flex flex-wrap gap-2">
          <select className={sel + ' min-w-0 flex-1'} value={rcp} onChange={(e) => setRcp(e.target.value)}>
            <option value="">Recipient...</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name + ' (' + p.role_code + ')'}</option>)}
          </select>
          <select className={sel} value={courier} onChange={(e) => setCourier(e.target.value)}>
            {COURIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className={sel + ' w-44'} placeholder="AWB / tracking no." value={awb} onChange={(e) => setAwb(e.target.value)} />
          <button className={btn()} disabled={busy || !rcp} onClick={register}>Log parcel</button>
        </div>
      </div>
      <div className="space-y-2"><Notice>{err}</Notice><Notice kind="ok">{ok}</Notice></div>
      <div className="space-y-2">
        {rows === null && <p className="text-sm text-slate-500">Loading...</p>}
        {(rows || []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <div className="text-xs font-semibold text-blue-700">{reqRef(t.ref)}</div>
              <div className="text-sm font-medium text-slate-900">{(t.who?.full_name || 'Recipient') + ' · ' + (t.meta?.courier || '')}</div>
              <div className="text-xs text-slate-500">{'AWB ' + (t.meta?.awb || 'n/a') + ' · Locker ' + (t.meta?.locker || '-') + ' · ' + ago(t.created_at)}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill s={t.status} />
              {OPEN.includes(t.status) && (
                <>
                  <input className={sel + ' w-24'} placeholder="PIN" maxLength={4} value={pins[t.id] || ''} onChange={(e) => setPins({ ...pins, [t.id]: e.target.value })} />
                  <button className={btn('good')} onClick={() => collect(t)}>Hand over</button>
                </>
              )}
            </div>
          </div>
        ))}
        {rows && !rows.length && <p className="text-sm text-slate-500">No parcels yet.</p>}
      </div>
    </div>
  );
}