import { useEffect, useMemo, useState } from 'react';
import { db, msg, OPEN, teamName } from '../../lib/req';
import { Notice } from '../../components/ReqBits';

const DONE = ['fulfilled', 'closed'];
const inr = (n) => '\u20b9' + Number(n || 0).toLocaleString('en-IN');
const tally = (arr, key) => {
  const m = {};
  arr.forEach((x) => { const k = key(x); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const Bar = ({ label, value, max, tone = 'bg-blue-500' }) => (
  <div className="flex items-center gap-3 text-sm">
    <div className="w-40 shrink-0 truncate text-slate-600" title={label}>{label}</div>
    <div className="h-2.5 flex-1 rounded bg-slate-100"><div className={'h-2.5 rounded ' + tone} style={{ width: (value && max ? Math.max(3, Math.round((value / max) * 100)) : 0) + '%' }} /></div>
    <div className="w-10 text-right font-medium text-slate-800">{value}</div>
  </div>
);
const Card = ({ title, children }) => (
  <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-700">{title}</div>{children}</div>
);
const Kpi = ({ k, v, sub }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-semibold text-slate-900">{v}</div>{sub && <div className="text-xs text-slate-400">{sub}</div>}</div>
);

function compute(d) {
  const now = Date.now();
  const labels = Object.fromEntries(d.r.map((x) => [x.category, x.label]));
  const open = d.t.filter((x) => OPEN.includes(x.status));
  const done = d.t.filter((x) => DONE.includes(x.status));
  const hrs = done.map((x) => (new Date(x.updated_at) - new Date(x.created_at)) / 36e5);
  const avgH = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0;
  const withSla = d.t.filter((x) => x.sla_due);
  const late = withSla.filter((x) => x.status === 'escalated' || (OPEN.includes(x.status) && new Date(x.sla_due) < now)
    || (DONE.includes(x.status) && new Date(x.updated_at) > new Date(x.sla_due))).length;
  const days = [...Array(7)].map((_, i) => {
    const dt = new Date(now - (6 - i) * 864e5);
    return [dt.toLocaleDateString([], { weekday: 'short' }), d.t.filter((x) => new Date(x.created_at).toDateString() === dt.toDateString()).length];
  });
  const ratings = [1, 2, 3, 4, 5].map((n) => [n + ' star', d.f.filter((x) => x.rating === n).length]);
  const avgR = d.f.length ? d.f.reduce((a, x) => a + x.rating, 0) / d.f.length : 0;
  const lv = {};
  d.b.forEach((x) => { lv[x.level] = lv[x.level] || { o: 0, n: 0 }; lv[x.level].n++; if (x.status !== 'free') lv[x.level].o++; });
  const sumC = (s) => d.c.filter((x) => x.status === s).reduce((a, x) => a + Number(x.amount), 0);
  return {
    total: d.t.length, open: open.length, done: done.length, avgH, late, slaPct: withSla.length ? Math.round(((withSla.length - late) / withSla.length) * 100) : 100,
    device: d.t.filter((x) => x.source === 'device').length, days, ratings, avgR, nR: d.f.length,
    cats: tally(d.t, (x) => labels[x.category] || x.category).slice(0, 8), teams: tally(d.t, (x) => teamName(x.team)).slice(0, 8),
    lv: ['LG', 'B1', 'B2', 'B3', 'B4'].filter((k) => lv[k]).map((k) => [k, lv[k].o, lv[k].n]), billed: sumC('billed'), pending: sumC('pending'),
  };
}

export default function Analytics() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      const [t, f, c, b, r] = await Promise.all([
        db.from('tickets').select('id,category,team,status,priority,source,created_at,updated_at,sla_due').order('created_at', { ascending: false }).limit(1000),
        db.from('feedback').select('rating'),
        db.from('charges').select('amount,status'),
        db.from('parking_bays').select('level,status').eq('vtype', 'car').limit(1000),
        db.from('category_routes').select('category,label'),
      ]);
      const bad = [t, f, c, b, r].find((x) => x.error);
      if (bad) return setErr(msg(bad.error));
      setD({ t: t.data, f: f.data, c: c.data, b: b.data, r: r.data });
    })();
  }, []);
  const s = useMemo(() => (d ? compute(d) : null), [d]);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-900">Analytics</h1><p className="text-sm text-slate-500">Service performance across the building, from the latest 1,000 requests</p></div>
      <Notice>{err}</Notice>
      {!s && !err && <p className="text-sm text-slate-500">Loading...</p>}
      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi k="Total requests" v={s.total} sub={s.open + ' open · ' + s.done + ' completed'} />
            <Kpi k="Within target time" v={s.slaPct + '%'} sub={s.late + ' request(s) late or escalated'} />
            <Kpi k="Average time to complete" v={s.avgH < 1 ? Math.round(s.avgH * 60) + ' min' : s.avgH.toFixed(1) + ' h'} sub={s.done + ' completed requests'} />
            <Kpi k="Average rating" v={s.nR ? s.avgR.toFixed(1) + ' / 5' : '-'} sub={s.nR + ' rating(s)'} />
            <Kpi k="Raised by devices" v={s.device} sub="Automatic, no human report" />
            <Kpi k="Food and service revenue billed" v={inr(s.billed)} />
            <Kpi k="Pending (not yet delivered)" v={inr(s.pending)} />
            <Kpi k="Parking (car bays in use)" v={s.lv.reduce((a, x) => a + x[1], 0) + ' / ' + s.lv.reduce((a, x) => a + x[2], 0)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="New requests, last 7 days">{s.days.map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(...s.days.map((x) => x[1]), 1)} />)}</Card>
            <Card title="Ratings">{s.ratings.map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(...s.ratings.map((x) => x[1]), 1)} tone="bg-amber-400" />)}</Card>
            <Card title="Busiest categories">{s.cats.map(([k, v]) => <Bar key={k} label={k} value={v} max={s.cats[0][1]} />)}</Card>
            <Card title="Busiest teams">{s.teams.map(([k, v]) => <Bar key={k} label={k} value={v} max={s.teams[0][1]} tone="bg-sky-500" />)}</Card>
            <Card title="Car parking use by level">{s.lv.map(([k, o, n]) => <Bar key={k} label={k + ' (of ' + n + ')'} value={o} max={n} tone="bg-indigo-500" />)}</Card>
          </div>
        </>
      )}
    </div>
  );
}