import { useCallback, useEffect, useState } from 'react';
import { db, msg, ago } from '../../lib/req';
import { Notice, Pill, btn } from '../../components/ReqBits';
import RequestDetail from '../../components/RequestDetail';

const EVENTS = {
  anpr: ['anpr_blacklist'], access: ['anpr_blacklist'], lift: ['lift_fault', 'lift_entrapment'], fire: ['fire_alarm'],
  bms: ['power_failure', 'hvac_high_temp'], hvac: ['hvac_high_temp'], pump: ['pump_fault'], water: ['tank_low', 'water_leak'],
  stp: ['pump_fault', 'water_leak'], ev: ['ev_fault'], network: ['network_outage'], wifi: ['wifi_weak'], meter: ['power_failure'],
};
const LABEL = {
  anpr_blacklist: 'Blacklisted vehicle', lift_fault: 'Lift fault', lift_entrapment: 'Lift entrapment', fire_alarm: 'FIRE ALARM',
  power_failure: 'Power failure', hvac_high_temp: 'High temperature', pump_fault: 'Pump fault', tank_low: 'Tank low',
  water_leak: 'Water leak', ev_fault: 'Charger fault', network_outage: 'Network outage', wifi_weak: 'Weak Wi-Fi',
};
const READING = {
  hvac_high_temp: '31 C at return air', tank_low: 'Level 12 percent', power_failure: 'Mains lost, DG starting',
  pump_fault: 'Tripped on overload', wifi_weak: '-82 dBm', network_outage: 'Core switch unreachable', water_leak: 'Moisture sensor wet',
};
const ST = {
  online: ['Online', 'bg-emerald-100 text-emerald-700'],
  fault: ['Fault', 'bg-amber-100 text-amber-800'],
  alarm: ['ALARM', 'bg-red-600 text-white'],
};
const SEV = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-800', info: 'bg-slate-100 text-slate-600' };

export default function Devices() {
  const [devs, setDevs] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      db.from('devices').select('*').order('code'),
      db.from('device_events').select('*, device:devices!device_id(code,name)').order('created_at', { ascending: false }).limit(25),
    ]);
    if (a.error || b.error) return setErr(msg(a.error || b.error));
    setDevs(a.data); setEvents(b.data);
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('dev-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'device_events' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const fire = async (d, ev) => {
    if (ev === 'fire_alarm' && !window.confirm('A fire alarm alerts every user in the building. Send it?')) return;
    setBusy(d.id + ev); setErr(''); setOk('');
    const payload = ev === 'reset' || !READING[ev] ? {} : { reading: READING[ev] };
    const { data, error } = await db.rpc('simulate_device_event', { p_device: d.id, p_event: ev, p_payload: payload });
    setBusy('');
    if (error) return setErr(msg(error));
    setOk(ev === 'reset' ? d.code + ' is back online' : d.code + ' · ' + (LABEL[ev] || ev) + ' · ' + (data.ticket_ids || []).length + ' request(s) raised automatically');
    load();
  };

  const counts = (devs || []).reduce((m, d) => { m[d.status] = (m[d.status] || 0) + 1; return m; }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Device simulator</h1>
        <p className="text-sm text-slate-500">Simulated building devices. Each event is turned into requests by rules, exactly as a real BMS or sensor feed would be.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Pill cls="bg-emerald-100 text-emerald-700">{(counts.online || 0) + ' online'}</Pill>
        <Pill cls="bg-amber-100 text-amber-800">{(counts.fault || 0) + ' fault'}</Pill>
        <Pill cls="bg-red-100 text-red-700">{(counts.alarm || 0) + ' alarm'}</Pill>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      {devs === null && <p className="text-sm text-slate-500">Loading...</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(devs || []).map((d) => {
          const [lab, cls] = ST[d.status] || [d.status, 'bg-slate-100 text-slate-600'];
          const evs = EVENTS[d.kind] || [];
          return (
            <div key={d.id} className={'rounded-2xl border bg-white p-4 shadow-sm ' + (d.status === 'alarm' ? 'border-red-300' : 'border-slate-200')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-blue-700">{d.code + ' · ' + d.kind}</div>
                  <div className="font-medium text-slate-900">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.location}</div>
                </div>
                <Pill cls={cls}>{lab}</Pill>
              </div>
              {d.last_event_at && <div className="mt-1 text-xs text-slate-400">{'Last event ' + ago(d.last_event_at)}</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {evs.map((ev) => (
                  <button key={ev} disabled={!!busy} className={btn(ev === 'fire_alarm' ? 'danger' : 'ghost') + ' !px-2 !py-1 !text-xs'} onClick={() => fire(d, ev)}>{LABEL[ev]}</button>
                ))}
                {!evs.length && <span className="text-xs text-slate-400">No simulated events for this device</span>}
                {d.status !== 'online' && <button disabled={!!busy} className={btn('good') + ' !px-2 !py-1 !text-xs'} onClick={() => fire(d, 'reset')}>Reset</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent device events</h2>
        <div className="space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">{(e.device?.code || '') + ' ' + (LABEL[e.event_type] || e.event_type)}</span>
                <span className="ml-2 text-slate-500">{e.device?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Pill cls={SEV[e.severity] || SEV.info}>{e.severity}</Pill>
                {(e.ticket_ids || []).length > 0 && <button className="text-xs text-blue-600 underline" onClick={() => setOpenId(e.ticket_ids[0])}>{e.ticket_ids.length + ' request(s)'}</button>}
                <span className="text-xs text-slate-400">{ago(e.created_at)}</span>
              </div>
            </div>
          ))}
          {!events.length && <p className="text-sm text-slate-500">No events yet. Try a fire alarm on D07.</p>}
        </div>
      </div>
      {openId && <RequestDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}