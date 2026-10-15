import { useCallback, useEffect, useState } from 'react';
import { db, msg, ago } from '../../lib/req';
import { Notice, Pill, inp, sel, btn } from '../../components/ReqBits';
import { PASS_TONE, passLink, when } from '../../components/PassBits';

const GATES = ['LG Main Gate', 'Reception Turnstile', 'Service Entrance', 'Delivery Bay'];
const tokenOf = (s) => s.trim().split('/').filter(Boolean).pop() || '';

export default function Gate() {
  const [gate, setGate] = useState(GATES[0]);
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passes, setPasses] = useState([]);
  const [scans, setScans] = useState([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      db.from('passes').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(40),
      db.from('pass_scans').select('*, pass:passes!pass_id(holder_name,kind)').order('created_at', { ascending: false }).limit(12),
    ]);
    setPasses(a.data || []); setScans(b.data || []);
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('gate-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pass_scans' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const scan = async (tk) => {
    if (!tk) return;
    setBusy(true); setRes(null); setErr('');
    const { data, error } = await db.rpc('scan_pass', { p_token: tk, p_gate: gate });
    setBusy(false);
    if (error) setErr(msg(error)); else { setRes(data); setText(''); }
    load();
  };
  const sweep = async () => {
    setErr('');
    const { data, error } = await db.rpc('expire_sweep');
    if (error) setErr(msg(error)); else { setRes({ ok: true, result: 'info', message: 'Expiry check finished · ' + data + ' item(s) updated' }); load(); }
  };

  const tone = !res ? '' : !res.ok ? 'bg-red-600' : res.result === 'exit' ? 'bg-blue-600' : res.result === 'info' ? 'bg-slate-700' : 'bg-emerald-600';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-slate-900">Gate scanner</h1><p className="text-sm text-slate-500">Scan visitor, parking, delivery and vendor passes</p></div>
        <button className={btn('ghost')} onClick={sweep}>Run expiry check</button>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select className={sel} value={gate} onChange={(e) => setGate(e.target.value)}>{GATES.map((g) => <option key={g}>{g}</option>)}</select>
        <input className={inp + ' min-w-0 flex-1'} placeholder="Paste a pass link or token" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scan(tokenOf(text))} />
        <button className={btn()} disabled={busy || !text.trim()} onClick={() => scan(tokenOf(text))}>Scan</button>
      </div>
      <Notice>{err}</Notice>
      {res && (
        <div className={'rounded-2xl p-5 text-white shadow ' + tone}>
          <div className="text-2xl font-bold">{res.message}</div>
          {res.holder && <div className="mt-1 text-sm opacity-90">{[res.kind, res.holder, res.zone].filter(Boolean).join(' · ')}</div>}
        </div>
      )}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{'Active passes (' + passes.length + ')'}</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Type</th><th className="p-3">Holder</th><th className="p-3">Zone</th><th className="p-3">Valid until</th><th className="p-3">Scans</th><th className="p-3" /></tr></thead>
            <tbody>
              {passes.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-3"><Pill cls="bg-blue-50 text-blue-700">{p.kind.replace('_', ' ')}</Pill></td>
                  <td className="p-3 font-medium text-slate-900">{p.holder_name}</td>
                  <td className="p-3 text-slate-600">{p.zone}</td>
                  <td className="p-3 text-slate-600">{when(p.valid_to)}</td>
                  <td className="p-3 text-slate-600">{p.uses + '/' + p.max_uses}</td>
                  <td className="p-3"><div className="flex gap-2"><button className={btn()} disabled={busy} onClick={() => scan(p.token)}>Scan</button><a className="self-center text-xs text-blue-600 underline" href={passLink(p.token)} target="_blank" rel="noreferrer">Open</a></div></td>
                </tr>
              ))}
              {!passes.length && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No active passes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent scans</h2>
        <div className="space-y-1.5">
          {scans.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <div><span className="font-medium text-slate-900">{s.pass?.holder_name || 'Unknown pass'}</span><span className="ml-2 text-slate-500">{s.gate}</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{s.message}</span><Pill cls={s.result === 'entry' || s.result === 'exit' ? PASS_TONE.active : PASS_TONE.revoked}>{s.result}</Pill><span className="text-xs text-slate-400">{ago(s.created_at)}</span></div>
            </div>
          ))}
          {!scans.length && <p className="text-sm text-slate-500">No scans yet.</p>}
        </div>
      </div>
    </div>
  );
}