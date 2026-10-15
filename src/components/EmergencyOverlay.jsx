import { useCallback, useEffect, useRef, useState } from 'react';
import { db, useAuth } from '../lib/req';

const IN_PANEL = typeof window !== 'undefined' && window.name === 'ascend-panel';
const RECENT_MS = 10 * 60 * 1000;

const CSS = [
  '@keyframes ea-flash { 0%, 49% { background: #b91c1c; } 50%, 100% { background: #fecaca; } }',
  '@keyframes ea-ring { 0%, 49% { border-color: #ffffff; } 50%, 100% { border-color: #b91c1c; } }',
  '.ea-bg { animation: ea-flash 1s steps(1) infinite; }',
  '.ea-card { animation: ea-ring 1s steps(1) infinite; }',
  '@media (prefers-reduced-motion: reduce) { .ea-bg { animation: none; background: #b91c1c; } .ea-card { animation: none; border-color: #b91c1c; } }',
].join('\n');

function startSiren() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.resume) ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    osc.type = 'square';
    osc.frequency.value = 660;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    let hi = false;
    const iv = setInterval(() => { hi = !hi; osc.frequency.value = hi ? 880 : 660; }, 500);
    return () => { clearInterval(iv); try { osc.stop(); ctx.close(); } catch (e) { /* ignore */ } };
  } catch (e) {
    return () => {};
  }
}

function Inner() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [sound, setSound] = useState(true);
  const seen = useRef(new Set());

  const add = useCallback((n) => {
    if (!n || n.level !== 'critical' || n.read) return;
    const key = n.ticket_id ? 't' + n.ticket_id : 'n' + n.id;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    setAlerts((a) => [n, ...a]);
  }, []);

  useEffect(() => {
    setAlerts([]);
    seen.current = new Set();
    if (!profile?.id) return undefined;
    const me = profile.id;
    let alive = true;
    db.from('notifications').select('*').eq('level', 'critical').eq('read', false)
      .gte('created_at', new Date(Date.now() - RECENT_MS).toISOString())
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (alive && data) data.slice().reverse().forEach(add); });
    const ch = db.channel('emergency-' + me + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + me }, (p) => add(p.new))
      .subscribe();
    return () => { alive = false; db.removeChannel(ch); };
  }, [profile?.id, add]);

  const active = alerts.length > 0;
  useEffect(() => {
    if (!active || !sound) return undefined;
    return startSiren();
  }, [active, sound]);

  const ack = async () => {
    setAlerts([]);
    if (profile?.id) {
      await db.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('level', 'critical').eq('read', false);
    }
  };

  if (!active) return null;
  const top = alerts[0];
  const portal = profile?.portal;
  const viewUrl = top.ticket_id && portal === 'admin' ? '/admin/requests?open=' + top.ticket_id
    : top.ticket_id && portal === 'staff' ? '/staff/queue?open=' + top.ticket_id : null;

  return (
    <div className="ea-bg fixed inset-0 z-[200] flex items-center justify-center p-4" role="alertdialog" aria-live="assertive" aria-label="Emergency alert">
      <style>{CSS}</style>
      <div className="ea-card w-full max-w-xl rounded-3xl border-8 bg-white p-6 text-center shadow-2xl sm:p-8">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-red-700">Emergency alert</div>
        <div className="mt-3 break-words text-3xl font-extrabold leading-tight text-red-700 sm:text-4xl">{top.title}</div>
        {top.body && <div className="mt-3 text-lg font-medium text-slate-800">{top.body}</div>}
        <div className="mt-2 text-sm text-slate-500">{new Date(top.created_at).toLocaleTimeString()}</div>
        {alerts.length > 1 && <div className="mt-2 text-sm font-semibold text-red-700">{'+' + (alerts.length - 1) + ' more alert(s)'}</div>}
        <p className="mt-4 text-sm text-slate-600">Follow your building's emergency procedure. This demo alert does not replace certified fire and life-safety systems.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={ack} className="rounded-xl bg-red-700 px-6 py-3 text-lg font-bold text-white hover:bg-red-800">Acknowledge</button>
          {viewUrl && <button onClick={() => { ack().then(() => window.location.assign(viewUrl)); }} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-800 hover:bg-slate-50">View request</button>}
          <button onClick={() => setSound(!sound)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">{sound ? 'Sound on' : 'Sound off'}</button>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyOverlay() {
  if (IN_PANEL) return null;
  return <Inner />;
}