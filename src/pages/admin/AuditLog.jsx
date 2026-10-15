import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, msg, ago } from '../../lib/req';
import { Notice, Pill, sel, btn } from '../../components/ReqBits';
import { when } from '../../components/PassBits';

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) setErr(msg(error)); else { setErr(''); setRows(data); }
  }, []);
  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [load]);

  const actions = useMemo(() => [...new Set((rows || []).map((r) => r.action))].sort(), [rows]);
  const shown = (rows || []).filter((r) => (!action || r.action === action)
    && (!text.trim() || (r.actor_name + ' ' + r.action + ' ' + (r.entity_id || '') + ' ' + JSON.stringify(r.details || {})).toLowerCase().includes(text.trim().toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
          <p className="text-sm text-slate-500">Who did what and when. Refreshes every 10 seconds. Latest 300 entries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input className={sel + ' w-52'} placeholder="Search..." value={text} onChange={(e) => setText(e.target.value)} />
          <button className={btn('ghost')} onClick={load}>Refresh</button>
        </div>
      </div>
      <Notice>{err}</Notice>
      {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Item</th><th className="p-3">Details</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap p-3 text-slate-600"><div>{when(r.created_at)}</div><div className="text-xs text-slate-400">{ago(r.created_at)}</div></td>
                  <td className="p-3 font-medium text-slate-900">{r.actor_name || 'System'}</td>
                  <td className="p-3"><Pill cls="bg-blue-50 text-blue-700">{r.action}</Pill></td>
                  <td className="p-3 text-slate-600">{(r.entity || '') + ' ' + (r.entity_id || '')}</td>
                  <td className="max-w-xs break-words p-3 font-mono text-xs text-slate-500">{r.details ? JSON.stringify(r.details) : ''}</td>
                </tr>
              ))}
              {!shown.length && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No entries match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}