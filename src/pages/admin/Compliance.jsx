import { useCallback, useEffect, useState } from 'react';
import { db, msg, OPEN } from '../../lib/req';
import { Notice, Pill, btn } from '../../components/ReqBits';

// IGBC Gold and ECBC are named in the sales deck. The rest are SAMPLE records (offsets from today) to show the renewal loop.
const CERTS = [
  { name: 'IGBC Gold green building certification', src: 'Sales deck', days: null, cat: 'energy_alert', where: 'Whole building' },
  { name: 'ECBC energy conservation compliance', src: 'Sales deck', days: null, cat: 'energy_alert', where: 'Whole building' },
  { name: 'Fire safety NOC renewal', src: 'Sample', days: 200, cat: 'maintenance', where: 'LG · Electrical panel room' },
  { name: 'Lift annual inspection licence', src: 'Sample', days: 45, cat: 'maintenance', where: 'Main lift lobby' },
  { name: 'STP consent to operate', src: 'Sample', days: 320, cat: 'energy_alert', where: 'B4 · STP area' },
  { name: 'Treated water quality test (monthly)', src: 'Sample', days: -3, cat: 'energy_alert', where: 'B1 · Tank room' },
  { name: 'Rainwater pit pre-monsoon inspection', src: 'Sample', days: 90, cat: 'energy_alert', where: 'Upper Ground · Green belt' },
];
const statusOf = (days) => days === null ? ['Certified per sales deck', 'bg-emerald-100 text-emerald-700'] : days < 0 ? ['Overdue', 'bg-red-100 text-red-700'] : days <= 60 ? ['Due soon', 'bg-amber-100 text-amber-800'] : ['Valid', 'bg-emerald-100 text-emerald-700'];

export default function Compliance() {
  const [live, setLive] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const [t, dv, st] = await Promise.all([
      db.from('tickets').select('id,priority,status,sla_due').in('status', OPEN).limit(500),
      db.from('devices').select('id,status'),
      db.from('stock_items').select('id,qty,reorder_level'),
    ]);
    const bad = [t, dv, st].find((x) => x.error);
    if (bad) return setErr(msg(bad.error));
    setLive([
      ['Open requests past their target time', t.data.filter((x) => x.sla_due && new Date(x.sla_due) < Date.now()).length],
      ['Urgent requests open', t.data.filter((x) => x.priority === 'critical').length],
      ['Devices in fault or alarm', dv.data.filter((x) => x.status !== 'online').length],
      ['Stock items at or below reorder level', st.data.filter((x) => Number(x.qty) <= Number(x.reorder_level)).length],
    ]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const raise = async (c) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('raise_ticket', { p_category: c.cat, p_title: 'Compliance: ' + c.name, p_description: 'Raised from the compliance register. ' + (c.src === 'Sample' ? 'Sample record.' : ''), p_location: c.where, p_priority: null });
    if (error) setErr(msg(error)); else { setOk('Inspection task raised and routed to the responsible team'); load(); }
  };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-900">Compliance</h1><p className="text-sm text-slate-500">Live health checks from the building data, plus a certificate register with renewal tasks</p></div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(live || []).map(([k, v]) => (
          <div key={k} className={'rounded-2xl border bg-white p-4 ' + (v > 0 ? 'border-amber-300' : 'border-slate-200')}>
            <div className="text-xs text-slate-500">{k}</div><div className={'text-2xl font-semibold ' + (v > 0 ? 'text-amber-700' : 'text-emerald-700')}>{v}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Certificate or inspection</th><th className="p-3">Source</th><th className="p-3">Next due</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {CERTS.map((c) => {
              const [lab, cls] = statusOf(c.days);
              return (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{c.name}</td>
                  <td className="p-3"><Pill cls={c.src === 'Sample' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}>{c.src === 'Sample' ? 'Sample data' : c.src}</Pill></td>
                  <td className="p-3 text-slate-600">{c.days === null ? '-' : new Date(Date.now() + c.days * 864e5).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="p-3"><Pill cls={cls}>{lab}</Pill></td>
                  <td className="p-3 text-right">{(c.days !== null && c.days <= 60) && <button className={btn() + ' !px-2 !py-1 !text-xs'} onClick={() => raise(c)}>Raise inspection task</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Only IGBC Gold and ECBC come from the sales deck. Other rows are illustrative sample data with dates relative to today, not real certificates.</p>
    </div>
  );
}