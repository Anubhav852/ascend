import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, useAuth, reqRef, teamName, TEAMS, OPEN, ago, due, msg } from '../lib/req';
import { StatusPill, PrioPill, Pill, Notice, sel, btn } from './ReqBits';
import RequestDetail from './RequestDetail';

const PW = { critical: 0, high: 1, normal: 2, low: 3 };
const COLS = [
  ['New', ['raised', 'routed']],
  ['In progress', ['accepted', 'in_progress', 'on_hold']],
  ['Escalated', ['escalated']],
  ['Done recently', ['fulfilled', 'closed', 'rejected', 'cancelled', 'expired']],
];

function Card({ t, onOpen, showTeam }) {
  const d = due(t);
  const crit = t.priority === 'critical' && OPEN.includes(t.status);
  return (
    <button onClick={() => onOpen(t.id)}
      className={'w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow ' + (crit ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-blue-700">{reqRef(t.ref)}</span>
        <span className="text-xs text-slate-400">{ago(t.created_at)}</span>
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{t.title}</div>
      <div className="mt-1 text-xs text-slate-500">{[t.location, showTeam && teamName(t.team)].filter(Boolean).join(' · ')}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill s={t.status} />
        {t.priority !== 'normal' && <PrioPill p={t.priority} />}
        {t.source === 'device' && <Pill cls="bg-violet-100 text-violet-700">Device</Pill>}
        {d && <span className={'text-xs ' + (d.late ? 'font-semibold text-red-600' : 'text-slate-500')}>{d.text}</span>}
      </div>
    </button>
  );
}

export default function RequestBoard({ scope, layout = 'list', title, subtitle, sweep = false, teamFilter = false }) {
  const { profile } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [tab, setTab] = useState('open');
  const [text, setText] = useState('');
  const [team, setTeam] = useState('');
  const [company, setCompany] = useState(false);
  const [openId, setOpenId] = useState(sp.get('open'));

  const load = useCallback(async () => {
    if (!profile) return;
    let q = db.from('tickets').select('*').order('created_at', { ascending: false }).limit(300);
    if (scope === 'mine') { q = q.is('parent_id', null); if (!company) q = q.eq('requester_id', profile.id); }
    if (scope === 'queue') q = q.or('linked_type.is.null,linked_type.neq.order');
    const { data, error } = await q;
    if (error) setErr(msg(error)); else { setErr(''); setRows(data); }
  }, [profile, scope, company]);

  useEffect(() => {
    load();
    const ch = db.channel('rb-' + scope + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [load, scope]);

  const list = useMemo(() => {
    const s = text.trim().toLowerCase();
    return (rows || [])
      .filter((t) => !team || t.team === team)
      .filter((t) => !s || (t.title + ' ' + t.ref + ' ' + (t.location || '')).toLowerCase().includes(s))
      .sort((a, b) => (OPEN.includes(a.status) && OPEN.includes(b.status) ? PW[a.priority] - PW[b.priority] : 0) || new Date(b.created_at) - new Date(a.created_at));
  }, [rows, text, team]);

  const shown = tab === 'all' ? list : list.filter((t) => (tab === 'open') === OPEN.includes(t.status));
  const closeDetail = () => { setOpenId(null); if (sp.get('open')) setSp({}, { replace: true }); load(); };
  const runSweep = async () => {
    setOk(''); setErr('');
    const { data, error } = await db.rpc('expire_sweep');
    if (error) setErr(msg(error)); else { setOk('SLA check finished · ' + data + ' item(s) updated'); load(); }
  };
  const showTeam = scope !== 'queue';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope === 'mine' && profile?.role_code === 'T1' && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={company} onChange={(e) => setCompany(e.target.checked)} /> Whole company
            </label>
          )}
          {teamFilter && (
            <select className={sel} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {Object.entries(TEAMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <input className={sel + ' w-48'} placeholder="Search..." value={text} onChange={(e) => setText(e.target.value)} />
          {sweep && <button className={btn('ghost')} onClick={runSweep}>Run SLA check</button>}
        </div>
      </div>
      <div className="mb-3 space-y-2"><Notice>{err}</Notice><Notice kind="ok">{ok}</Notice></div>

      {layout === 'list' && (
        <div className="mb-3 flex gap-2">
          {[['open', 'Open'], ['done', 'Finished'], ['all', 'All']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={'rounded-full border px-3 py-1 text-sm ' + (tab === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>{l}</button>
          ))}
        </div>
      )}

      {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : layout === 'list' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((t) => <Card key={t.id} t={t} onOpen={setOpenId} showTeam={showTeam} />)}
          {!shown.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 md:col-span-2">Nothing here yet.</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map(([name, sts]) => {
            const items = list.filter((t) => sts.includes(t.status)).slice(0, name.startsWith('Done') ? 10 : 100);
            return (
              <div key={name} className="rounded-2xl bg-slate-100 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">{name}</h3>
                  <Pill cls="bg-white text-slate-600">{items.length}</Pill>
                </div>
                <div className="space-y-2">
                  {items.map((t) => <Card key={t.id} t={t} onOpen={setOpenId} showTeam={showTeam} />)}
                  {!items.length && <p className="py-4 text-center text-xs text-slate-400">Nothing here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openId && <RequestDetail id={openId} onClose={closeDetail} />}
    </div>
  );
}