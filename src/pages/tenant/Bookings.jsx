import { useCallback, useEffect, useState } from 'react';
import { db, useAuth, msg } from '../../lib/req';
import { Notice, Pill, inp, sel, btn } from '../../components/ReqBits';
import { localInput, when } from '../../components/PassBits';

const KINDS = [['room', 'Meeting rooms'], ['desk', 'Desks'], ['locker', 'Lockers'], ['ev_charger', 'EV chargers'], ['event_space', 'Event spaces']];
const TONE = {
  pending: ['Awaiting approval', 'bg-amber-100 text-amber-800'], confirmed: ['Confirmed', 'bg-emerald-100 text-emerald-700'],
  rejected: ['Declined', 'bg-rose-100 text-rose-700'], cancelled: ['Cancelled', 'bg-slate-100 text-slate-500'], completed: ['Completed', 'bg-slate-100 text-slate-600'],
};
const hour = (add) => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + add); return localInput(d); };
const lbl = 'mb-1 block text-sm font-medium text-slate-700';

export default function Bookings() {
  const { profile } = useAuth();
  const [res, setRes] = useState([]);
  const [kind, setKind] = useState('room');
  const [rid, setRid] = useState('');
  const [date, setDate] = useState(hour(1).slice(0, 10));
  const [st, setSt] = useState(hour(1).slice(11, 16));
  const [en, setEn] = useState(hour(2).slice(11, 16));
  const [pax, setPax] = useState(1);
  const [title, setTitle] = useState('');
  const [taken, setTaken] = useState([]);
  const [mine, setMine] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const m = await db.from('bookings').select('*, resource:resources!resource_id(name,kind,level)').eq('user_id', profile.id).order('starts_at', { ascending: false }).limit(20);
    setMine(m.data || []);
    if (rid) {
      const t = await db.from('bookings').select('id,starts_at,ends_at,title,status,who:profiles!user_id(full_name)')
        .eq('resource_id', rid).in('status', ['pending', 'confirmed']).gte('ends_at', new Date().toISOString()).order('starts_at');
      setTaken(t.data || []);
    } else setTaken([]);
  }, [profile, rid]);

  useEffect(() => { db.from('resources').select('*').order('name').then(({ data }) => setRes(data || [])); }, []);
  useEffect(() => {
    load();
    const ch = db.channel('book-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load).subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  const choices = res.filter((r) => r.kind === kind);
  const cur = res.find((r) => r.id === rid);

  const book = async () => {
    setBusy(true); setErr(''); setOk('');
    const { data, error } = await db.rpc('book_resource', {
      p_resource: rid, p_starts: new Date(date + 'T' + st).toISOString(), p_ends: new Date(date + 'T' + en).toISOString(),
      p_title: title.trim() || null, p_attendees: Number(pax) || 1,
    });
    setBusy(false);
    if (error) return setErr(msg(error));
    setOk(data.status === 'pending' ? 'Sent for approval - you will be notified' : 'Booked and confirmed'); setTitle(''); load();
  };
  const cancel = async (b) => {
    setErr(''); setOk('');
    const { error } = await db.rpc('cancel_booking', { p_booking: b.id });
    if (error) setErr(msg(error)); else { setOk('Booking cancelled'); load(); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Book a space</h1>
        <p className="text-sm text-slate-500">Rooms, desks, lockers, EV chargers and event spaces. Clashes are blocked automatically.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(([k, l]) => (
          <button key={k} onClick={() => { setKind(k); setRid(''); }} className={'rounded-full border px-3 py-1 text-sm ' + (kind === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>{l}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Choose one</label>
            <select className={sel + ' w-full'} value={rid} onChange={(e) => { setRid(e.target.value); const r = res.find((x) => x.id === e.target.value); if (r && Number(pax) > r.capacity) setPax(r.capacity); }}>
              <option value="">Select...</option>
              {choices.map((r) => <option key={r.id} value={r.id}>{r.name + ' · ' + (r.level || '') + ' · up to ' + r.capacity}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Date</label><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className={lbl}>People</label><input type="number" min="1" className={inp} value={pax} onChange={(e) => setPax(e.target.value)} /></div>
          <div><label className={lbl}>From</label><input type="time" className={inp} value={st} onChange={(e) => setSt(e.target.value)} /></div>
          <div><label className={lbl}>To</label><input type="time" className={inp} value={en} onChange={(e) => setEn(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Title (optional)</label><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint review" /></div>
        </div>
        {cur?.needs_approval && <p className="mt-3 text-sm text-amber-700">This one needs approval from the events team. Approved events also create catering, housekeeping, security, AV and signage tasks.</p>}
        {taken.length > 0 && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div className="mb-1 font-medium text-slate-700">Already booked</div>
            {taken.map((t) => <div key={t.id}>{when(t.starts_at) + ' to ' + when(t.ends_at) + ' · ' + (t.who?.full_name || '') + (t.status === 'pending' ? ' (pending)' : '')}</div>)}
          </div>
        )}
        <div className="mt-3"><Notice>{err}</Notice><Notice kind="ok">{ok}</Notice></div>
        <button className={btn() + ' mt-3'} disabled={busy || !rid} onClick={book}>{busy ? 'Booking...' : 'Book it'}</button>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">My bookings</h2>
        <div className="space-y-2">
          {mine.map((b) => {
            const [lab, cls] = TONE[b.status] || [b.status, 'bg-slate-100'];
            return (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{(b.resource?.name || 'Booking') + (b.title && b.title !== b.resource?.name ? ' · ' + b.title : '')}</div>
                  <div className="text-xs text-slate-500">{when(b.starts_at) + ' to ' + when(b.ends_at) + ' · ' + b.attendees + ' people'}</div>
                </div>
                <div className="flex items-center gap-2"><Pill cls={cls}>{lab}</Pill>{['pending', 'confirmed'].includes(b.status) && <button className={btn('ghost')} onClick={() => cancel(b)}>Cancel</button>}</div>
              </div>
            );
          })}
          {!mine.length && <p className="text-sm text-slate-500">No bookings yet.</p>}
        </div>
      </div>
    </div>
  );
}