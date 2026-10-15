import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, msg, reqRef, OPEN, ago } from '../../lib/req';
import { Notice, Pill, StatusPill, PrioPill } from '../../components/ReqBits';
import RequestDetail from '../../components/RequestDetail';

const FLOORS = [
  ['TR', 'Terrace', 'Hospitality'], ['F12', '12th floor', 'Hospitality'], ['F11', '11th floor', 'Hospitality'], ['FM', 'Mezzanine', 'Hospitality'],
  ['F10', '10th · Environment Deck', 'Deck'], ['F9', '9th floor', 'Hospitality'], ['F8', '8th floor', 'Hospitality'], ['F7', '7th floor', 'Hospitality'],
  ['F6', '6th floor', 'Offices'], ['F5', '5th floor', 'Offices'], ['F4', '4th floor', 'Offices'], ['F3', '3rd floor', 'Offices'], ['F2', '2nd floor', 'Offices'],
  ['F1', '1st floor', 'Retail'], ['UG', 'Upper Ground', 'Retail'], ['LG', 'Lower Ground', 'Arrival and amenities'],
  ['B1', 'Basement 1', 'Parking'], ['B2', 'Basement 2', 'Parking'], ['B3', 'Basement 3', 'Parking'], ['B4', 'Basement 4', 'Parking'],
  ['OTHER', 'Not placed on a floor', 'Parking desk, lifts, general'],
];

export function levelOf(s) {
  const t = (s || '').toLowerCase();
  let m;
  if ((m = t.match(/unit\s*([1-9])\d\d/))) return 'F' + m[1];
  if ((m = t.match(/\b(b[1-4])\b/))) return m[1].toUpperCase();
  if (/\blg\b|lower ground|reception/.test(t)) return 'LG';
  if (/\bug\b|upper ground/.test(t)) return 'UG';
  if (/environment deck|events? space|restaurant|central kitchen/.test(t)) return 'F10';
  if (/mezzanine/.test(t)) return 'FM';
  if (/terrace|roof/.test(t)) return 'TR';
  if ((m = t.match(/(\d{1,2})(st|nd|rd|th)\s*floor/))) return 'F' + m[1];
  if ((m = t.match(/floor\s*(\d{1,2})/))) return 'F' + m[1];
  return 'OTHER';
}

export default function BuildingView() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const [t, v, b, w] = await Promise.all([
      db.from('tickets').select('id,ref,title,status,priority,location,source,created_at').in('status', OPEN).limit(500),
      db.from('devices').select('id,code,name,location,status'),
      db.from('parking_bays').select('level,status').eq('vtype', 'car').limit(1000),
      db.from('visitors').select('id', { count: 'exact', head: true }).eq('status', 'arrived'),
    ]);
    const bad = [t, v, b, w].find((x) => x.error);
    if (bad) return setErr(msg(bad.error));
    setErr(''); setD({ t: t.data, v: v.data, b: b.data, onsite: w.count || 0 });
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('bv-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_bays' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const by = useMemo(() => {
    const m = {};
    FLOORS.forEach(([k]) => { m[k] = { t: [], dev: [], occ: 0, tot: 0 }; });
    if (!d) return m;
    d.t.forEach((x) => { m[levelOf(x.location)].t.push(x); });
    d.v.forEach((x) => { if (x.status !== 'online') m[levelOf(x.location)].dev.push(x); });
    d.b.forEach((x) => { if (m[x.level]) { m[x.level].tot++; if (x.status === 'occupied' || x.status === 'reserved') m[x.level].occ++; } });
    return m;
  }, [d]);

  const crit = d ? d.t.filter((x) => x.priority === 'critical').length : 0;
  const alarms = d ? d.v.filter((x) => x.status !== 'online').length : 0;
  const parked = d ? d.b.filter((x) => x.status === 'occupied' || x.status === 'reserved').length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Building view</h1>
        <p className="text-sm text-slate-500">Every floor at a glance. Updates live. Click a floor to see its open requests.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Open requests', d ? d.t.length : '-'], ['Urgent', crit], ['Devices in fault or alarm', alarms], ['Visitors on site', d ? d.onsite : '-']].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-semibold text-slate-900">{v}</div></div>
        ))}
      </div>
      <Notice>{err}</Notice>
      {!d && !err && <p className="text-sm text-slate-500">Loading...</p>}
      {d && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {FLOORS.map(([k, name, use]) => {
            const f = by[k];
            if (k === 'OTHER' && !f.t.length) return null;
            const n = f.t.length;
            const hot = f.t.some((x) => x.priority === 'critical') || f.dev.some((x) => x.status === 'alarm');
            const bg = hot ? 'bg-red-50' : n > 5 ? 'bg-amber-50' : n > 0 ? 'bg-blue-50' : 'bg-white';
            return (
              <div key={k} className="border-b border-slate-100 last:border-0">
                <button onClick={() => setSel(sel === k ? null : k)} className={'flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ' + bg}>
                  <div className="w-10 text-xs font-bold text-slate-500">{k === 'OTHER' ? '?' : k}</div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-900">{name}</div><div className="text-xs text-slate-500">{use}</div></div>
                  {f.tot > 0 && <span className="text-xs text-slate-500">{'Cars ' + f.occ + '/' + f.tot}</span>}
                  {f.dev.length > 0 && <Pill cls={f.dev.some((x) => x.status === 'alarm') ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'}>{f.dev.map((x) => x.code).join(' ') + ' ' + (f.dev.some((x) => x.status === 'alarm') ? 'ALARM' : 'fault')}</Pill>}
                  <Pill cls={n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}>{n + ' open'}</Pill>
                </button>
                {sel === k && (
                  <div className="space-y-1.5 bg-slate-50 px-4 py-3">
                    {f.t.map((x) => (
                      <button key={x.id} onClick={() => setOpenId(x.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:shadow">
                        <div><span className="text-xs font-semibold text-blue-700">{reqRef(x.ref)}</span><span className="ml-2 font-medium text-slate-900">{x.title}</span><div className="text-xs text-slate-500">{(x.location || '') + ' · ' + ago(x.created_at)}</div></div>
                        <div className="flex items-center gap-1.5"><StatusPill s={x.status} />{x.priority !== 'normal' && <PrioPill p={x.priority} />}{x.source === 'device' && <Pill cls="bg-violet-100 text-violet-700">Device</Pill>}</div>
                      </button>
                    ))}
                    {!f.t.length && <p className="text-sm text-slate-500">Nothing open on this floor.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">{'Cars parked or reserved: ' + parked + '. Floor use follows the section drawing in the sales deck. Requests are placed on a floor from their location text.'}</p>
      {openId && <RequestDetail id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}