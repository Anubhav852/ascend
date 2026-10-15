import { useCallback, useEffect, useState } from 'react';
import { db, msg, teamName, reqRef } from '../../lib/req';
import { Notice, Pill, StatusPill, inp, btn } from '../../components/ReqBits';
import { when } from '../../components/PassBits';

export default function Events() {
  const [rows, setRows] = useState(null);
  const [kids, setKids] = useState({});
  const [notes, setNotes] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await db.from('bookings')
      .select('*, resource:resources!resource_id(name,kind), who:profiles!user_id(full_name), tn:tenants!tenant_id(name)')
      .order('starts_at', { ascending: false }).limit(80);
    if (error) return setErr(msg(error));
    const ev = (data || []).filter((b) => b.resource?.kind === 'event_space');
    setRows(ev);
    const ids = ev.filter((b) => b.ticket_id && b.status === 'confirmed').map((b) => b.ticket_id);
    if (!ids.length) return setKids({});
    const k = await db.from('tickets').select('id,ref,title,team,status,parent_id').in('parent_id', ids);
    const g = {};
    (k.data || []).forEach((t) => { (g[t.parent_id] = g[t.parent_id] || []).push(t); });
    setKids(g);
  }, []);
  useEffect(() => {
    load();
    const ch = db.channel('ev-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const decide = async (b, yes) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('approve_booking', { p_booking: b.id, p_approve: yes, p_note: notes[b.id] || null });
    if (error) setErr(msg(error));
    else { setOk(yes ? 'Approved - 5 linked tasks created: catering, housekeeping, security, AV and signage' : 'Declined'); load(); }
  };

  const pending = (rows || []).filter((b) => b.status === 'pending');
  const confirmed = (rows || []).filter((b) => b.status === 'confirmed');

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-slate-900">Event approvals</h1><p className="text-sm text-slate-500">Approving an event creates the tasks every team needs</p></div>
      <Notice>{err}</Notice><Notice kind="ok">{ok}</Notice>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{'Waiting for approval (' + pending.length + ')'}</h2>
        <div className="space-y-2">
          {pending.map((b) => (
            <div key={b.id} className="space-y-2 rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{b.title}</div>
                  <div className="text-sm text-slate-600">{b.resource?.name + ' · ' + when(b.starts_at) + ' to ' + when(b.ends_at) + ' · ' + b.attendees + ' guests'}</div>
                  <div className="text-xs text-slate-500">{[b.who?.full_name, b.tn?.name].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input className={inp + ' min-w-0 flex-1'} placeholder="Note to the organizer (optional)" value={notes[b.id] || ''} onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} />
                <button className={btn('good')} onClick={() => decide(b, true)}>Approve</button>
                <button className={btn('danger')} onClick={() => decide(b, false)}>Decline</button>
              </div>
            </div>
          ))}
          {rows && !pending.length && <p className="text-sm text-slate-500">Nothing waiting.</p>}
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{'Confirmed events (' + confirmed.length + ')'}</h2>
        <div className="space-y-2">
          {confirmed.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{b.title}</span><Pill cls="bg-emerald-100 text-emerald-700">Confirmed</Pill></div>
              <div className="text-sm text-slate-600">{b.resource?.name + ' · ' + when(b.starts_at) + ' · ' + b.attendees + ' guests · ' + (b.who?.full_name || '')}</div>
              {(kids[b.ticket_id] || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {kids[b.ticket_id].map((t) => <span key={t.id} className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">{teamName(t.team) + ' · ' + reqRef(t.ref)}<StatusPill s={t.status} /></span>)}
                </div>
              )}
            </div>
          ))}
          {rows && !confirmed.length && <p className="text-sm text-slate-500">No confirmed events.</p>}
        </div>
      </div>
    </div>
  );
}