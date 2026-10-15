import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, useAuth, msg } from '../lib/req';
import { Notice, Pill, sel, btn } from '../components/ReqBits';
import { when } from '../components/PassBits';

const inr = (n) => '\u20b9' + Number(n || 0).toLocaleString('en-IN');
const TONE = { pending: 'bg-amber-100 text-amber-800', billed: 'bg-emerald-100 text-emerald-700', void: 'bg-slate-100 text-slate-500' };

export default function Billing() {
  const { profile } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [tn, setTn] = useState('');
  const [st, setSt] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.from('charges')
      .select('*, tn:tenants!tenant_id(name), who:profiles!user_id(full_name)').order('created_at', { ascending: false }).limit(500);
    if (error) setErr(msg(error)); else { setErr(''); setRows(data); }
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('chg-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'charges' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const tenants = useMemo(() => [...new Set((rows || []).map((r) => r.tn?.name || 'Individual'))].sort(), [rows]);
  const list = (rows || []).filter((r) => (!tn || (r.tn?.name || 'Individual') === tn) && (!st || r.status === st));
  const sum = (s) => list.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount), 0);
  const perTenant = useMemo(() => {
    const m = {};
    list.forEach((r) => {
      const k = r.tn?.name || 'Individual';
      m[k] = m[k] || { billed: 0, pending: 0, n: 0 };
      if (r.status === 'billed') m[k].billed += Number(r.amount);
      if (r.status === 'pending') m[k].pending += Number(r.amount);
      m[k].n++;
    });
    return Object.entries(m).sort((a, b) => b[1].billed + b[1].pending - (a[1].billed + a[1].pending));
  }, [list]);

  const exportCsv = () => {
    const head = ['Date', 'Tenant', 'User', 'Description', 'Type', 'Amount', 'Status'];
    const lines = [head].concat(list.map((c) => [new Date(c.created_at).toISOString().slice(0, 10), c.tn?.name || '', c.who?.full_name || '', c.description, c.source_type, c.amount, c.status]));
    const csv = lines.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'ascend-charges.csv';
    a.click();
  };

  const admin = profile?.portal === 'admin';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{admin ? 'Billing and charges' : 'Charges'}</h1>
          <p className="text-sm text-slate-500">{admin ? 'Charges raised by food orders and other services, by tenant' : 'Charges for your company and your own orders'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && <select className={sel} value={tn} onChange={(e) => setTn(e.target.value)}><option value="">All tenants</option>{tenants.map((t) => <option key={t}>{t}</option>)}</select>}
          <select className={sel} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="billed">Billed</option><option value="void">Void</option></select>
          <button className={btn('ghost')} onClick={exportCsv} disabled={!list.length}>Export CSV</button>
        </div>
      </div>
      <Notice>{err}</Notice>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Billed', inr(sum('billed')), 'text-emerald-700'], ['Pending (not yet delivered)', inr(sum('pending')), 'text-amber-700'], ['Void (cancelled)', inr(sum('void')), 'text-slate-500']].map(([k, v, c]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{k}</div><div className={'text-2xl font-semibold ' + c}>{v}</div></div>
        ))}
      </div>
      {admin && perTenant.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Tenant</th><th className="p-3">Charges</th><th className="p-3">Billed</th><th className="p-3">Pending</th></tr></thead>
            <tbody>{perTenant.map(([k, v]) => (<tr key={k} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-900">{k}</td><td className="p-3 text-slate-600">{v.n}</td><td className="p-3 text-emerald-700">{inr(v.billed)}</td><td className="p-3 text-amber-700">{inr(v.pending)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Tenant</th><th className="p-3">User</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap p-3 text-slate-600">{when(c.created_at)}</td>
                  <td className="p-3 text-slate-600">{c.tn?.name || '-'}</td>
                  <td className="p-3 text-slate-600">{c.who?.full_name || '-'}</td>
                  <td className="p-3 font-medium text-slate-900">{c.description}</td>
                  <td className="p-3 text-right font-medium">{inr(c.amount)}</td>
                  <td className="p-3"><Pill cls={TONE[c.status] || TONE.void}>{c.status}</Pill></td>
                </tr>
              ))}
              {!list.length && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No charges yet. Place a food order to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}