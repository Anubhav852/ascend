import { useCallback, useEffect, useState } from 'react';
import { db, useAuth, reqRef, teamName, OPEN, ago, due, msg } from '../lib/req';
import { StatusPill, PrioPill, Timeline, Notice, inp, btn } from './ReqBits';
import { Info, ParcelBox, PermitBox, TenantActions, VendorActions } from './ReqParts';
import StaffPanel from './ReqActions';

export default function RequestDetail({ id, onClose }) {
  const { profile } = useAuth();
  const [t, setT] = useState(null);
  const [events, setEvents] = useState([]);
  const [fb, setFb] = useState(null);
  const [pass, setPass] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const a = await db.from('tickets').select('*, assignee:profiles!assignee_id(full_name), vendor:vendors(name)').eq('id', id).single();
    if (a.error) { setErr(msg(a.error)); return; }
    setT(a.data);
    const [b, c, d] = await Promise.all([
      db.from('ticket_events').select('*').eq('ticket_id', id).order('created_at'),
      db.from('feedback').select('*').eq('ticket_id', id).maybeSingle(),
      db.from('passes').select('*').eq('ticket_id', id).eq('kind', 'vendor').order('created_at', { ascending: false }).limit(1),
    ]);
    setEvents(b.data || []); setFb(c.data || null); setPass((d.data || [])[0] || null);
  }, [id]);

  useEffect(() => {
    load();
    const ch = db.channel('rd-' + id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_events', filter: 'ticket_id=eq.' + id }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: 'id=eq.' + id }, load)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [id, load]);

  const run = async (okMsg, fn) => {
    setBusy(true); setErr(''); setOk('');
    try { const { error } = await fn(); if (error) throw error; setOk(okMsg); await load(); }
    catch (e) { setErr(msg(e)); }
    setBusy(false);
  };
  const addNote = async () => {
    if (!note.trim()) return;
    await run('Note added', () => db.rpc('add_ticket_note', { p_ticket: id, p_note: note.trim() }));
    setNote('');
  };

  const shell = (body) => (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-end"><button className={btn('ghost')} onClick={onClose}>Close</button></div>
        {body}
      </div>
    </div>
  );
  if (!t) return shell(err ? <Notice>{err}</Notice> : <p className="text-sm text-slate-500">Loading...</p>);

  const portal = profile?.portal;
  const staffSide = ['staff', 'admin', 'outlet'].includes(portal);
  const mine = t.requester_id === profile?.id;
  const isOpen = OPEN.includes(t.status);
  const d = due(t);

  return shell(
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-blue-700">{reqRef(t.ref)}</div>
        <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill s={t.status} /><PrioPill p={t.priority} />
          {d && <span className={'text-xs ' + (d.late ? 'font-semibold text-red-600' : 'text-slate-500')}>{d.text}</span>}
        </div>
      </div>
      <Notice>{err}</Notice>
      <Notice kind="ok">{ok}</Notice>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <Info k="Team" v={teamName(t.team)} />
        <Info k="Location" v={t.location || '-'} />
        <Info k="Raised" v={ago(t.created_at)} />
        <Info k="Assigned to" v={t.assignee?.full_name || 'Not yet'} />
        {t.vendor && <Info k="Vendor" v={t.vendor.name} />}
        {t.source === 'device' && <Info k="Source" v="Auto-raised by a device" />}
      </dl>
      {t.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{t.description}</p>}
      {t.category === 'parcel' && <ParcelBox t={t} mine={mine} isOpen={isOpen} />}
      {pass && (staffSide || portal === 'vendor') && <PermitBox pass={pass} />}
      {mine && <TenantActions t={t} fb={fb} run={run} busy={busy} />}
      {portal === 'vendor' && isOpen && <VendorActions t={t} run={run} busy={busy} />}
      {staffSide && <StaffPanel t={t} run={run} busy={busy} />}
      {(isOpen || staffSide) && (
        <div className="flex gap-2">
          <input className={inp} placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btn('ghost')} disabled={busy || !note.trim()} onClick={addNote}>Add</button>
        </div>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Activity</h3>
        <Timeline events={events} />
      </div>
    </div>
  );
}