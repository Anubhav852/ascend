import { useEffect, useState } from 'react';
import { db, TEAMS, OPEN } from '../lib/req';
import { sel, btn } from './ReqBits';
import { announce } from '../lib/handoff';

const Box = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200 p-3">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    {children}
  </div>
);

export default function StaffPanel({ t, run, busy }) {
  const [people, setPeople] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [who, setWho] = useState('');
  const [team, setTeam] = useState('');
  const [vendor, setVendor] = useState('');
  const [hours, setHours] = useState(8);

  useEffect(() => {
    db.from('profiles').select('id,full_name').eq('portal', 'staff').eq('team', t.team).eq('active', true)
      .then(({ data }) => setPeople(data || []));
    db.from('vendors').select('id,name,category').order('name').then(({ data }) => setVendors(data || []));
  }, [t.team]);

  if (!OPEN.includes(t.status)) return <p className="text-sm text-slate-500">This request is finished, so there are no more actions.</p>;

  const st = (s, label, kind) => (
    <button key={s} className={btn(kind)} disabled={busy || t.status === s}
      onClick={() => run(label + ' - done', () => db.rpc('set_ticket_status', { p_ticket: t.id, p_status: s, p_note: null }))}>{label}</button>
  );

  return (
    <div className="space-y-3">
      <Box title="Update status">
        <div className="flex flex-wrap gap-2">
          {st('accepted', 'Accept', 'ghost')}{st('in_progress', 'Start work', 'ghost')}{st('on_hold', 'Put on hold', 'ghost')}
          {st('fulfilled', 'Mark completed', 'good')}{st('rejected', 'Decline', 'danger')}
        </div>
      </Box>
      <Box title="Assign">
        <div className="flex flex-wrap gap-2">
          <button className={btn('ghost')} disabled={busy}
            onClick={() => run('Assigned to you', () => db.rpc('assign_ticket', { p_ticket: t.id, p_assignee: null }))}>Assign to me</button>
          <select className={sel + ' min-w-0 flex-1'} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Team member...</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <button className={btn()} disabled={busy || !who}
            onClick={() => run('Assigned', () => db.rpc('assign_ticket', { p_ticket: t.id, p_assignee: who }))}>Assign</button>
        </div>
      </Box>
      <Box title="Send to another team">
        <div className="flex flex-wrap gap-2">
          <select className={sel + ' min-w-0 flex-1'} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Choose team...</option>
            {Object.entries(TEAMS).filter(([k]) => k !== t.team).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className={btn()} disabled={busy || !team}
            onClick={() => run('Sent to ' + TEAMS[team], () => db.rpc('route_ticket', { p_ticket: t.id, p_team: team }).then((r) => { if (!r.error) announce({ id: t.id, ref: t.ref, title: t.title, team }); return r; }))}>Send</button>
        </div>
      </Box>
      <Box title="Send to a vendor (work order, permit and pass)">
        <div className="flex flex-wrap gap-2">
          <select className={sel + ' min-w-0 flex-1'} value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">Choose vendor...</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select className={sel} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={4}>4 h pass</option><option value={8}>8 h pass</option><option value={24}>24 h pass</option>
          </select>
          <button className={btn()} disabled={busy || !vendor}
            onClick={() => run('Work order sent', () => db.rpc('assign_vendor', { p_ticket: t.id, p_vendor: vendor, p_hours: hours }).then((r) => { if (!r.error) announce({ id: t.id, ref: t.ref, title: t.title, vendor }); return r; }))}>Send work order</button>
        </div>
      </Box>
    </div>
  );
}