import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, msg } from '../../lib/req';
import { Notice, Pill, sel, btn } from '../../components/ReqBits';

export default function Stock() {
  const [rows, setRows] = useState(null);
  const [cat, setCat] = useState('');
  const [custom, setCustom] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.from('stock_items').select('*').order('name');
    if (error) setErr(msg(error)); else setRows(data);
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('stock-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const cats = useMemo(() => [...new Set((rows || []).map((r) => r.category))], [rows]);
  const shown = (rows || []).filter((r) => !cat || r.category === cat);

  const adjust = async (s, d) => {
    if (!d) return;
    setErr(''); setOk('');
    const { data, error } = await db.rpc('adjust_stock', { p_item: s.id, p_delta: d, p_note: 'Adjusted from stock page' });
    if (error) return setErr(msg(error));
    setOk(s.name + ' is now ' + data.qty + ' ' + data.unit + (data.qty <= data.reorder_level ? ' · at or below reorder level, so a restock request goes to Stores' : ''));
    setCustom({ ...custom, [s.id]: '' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Stock</h1>
          <p className="text-sm text-slate-500">Falling to the reorder level raises a restock request automatically</p>
        </div>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-3">Item</th><th className="p-3">Level</th><th className="p-3">Reorder at</th><th className="p-3">Status</th><th className="p-3">Adjust</th></tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const low = s.qty <= s.reorder_level;
                const pct = Math.min(100, Math.round((s.qty / (s.reorder_level * 3)) * 100));
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-3"><div className="font-medium text-slate-900">{s.name}</div><div className="text-xs text-slate-500">{s.category + ' · ' + (s.location || '')}</div></td>
                    <td className="w-48 p-3">
                      <div className="font-medium">{s.qty + ' ' + s.unit}</div>
                      <div className="mt-1 h-1.5 rounded bg-slate-100"><div className={'h-1.5 rounded ' + (low ? 'bg-red-500' : 'bg-blue-500')} style={{ width: pct + '%' }} /></div>
                    </td>
                    <td className="p-3 text-slate-600">{s.reorder_level + ' ' + s.unit}</td>
                    <td className="p-3">{low ? <Pill cls="bg-red-100 text-red-700">Low</Pill> : <Pill cls="bg-emerald-100 text-emerald-700">OK</Pill>}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button className={btn('ghost')} onClick={() => adjust(s, -1)}>-1</button>
                        <button className={btn('ghost')} onClick={() => adjust(s, -5)}>-5</button>
                        <button className={btn('ghost')} onClick={() => adjust(s, 10)}>+10</button>
                        <input type="number" className={sel + ' w-20'} placeholder="+/-" value={custom[s.id] ?? ''} onChange={(e) => setCustom({ ...custom, [s.id]: e.target.value })} />
                        <button className={btn()} onClick={() => adjust(s, Number(custom[s.id]))}>Apply</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}