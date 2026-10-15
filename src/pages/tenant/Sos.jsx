import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db, msg } from '../../lib/req';
import { Notice, inp, btn } from '../../components/ReqBits';

export default function Sos() {
  const [loc, setLoc] = useState('');
  const [note, setNote] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  const send = async () => {
    setBusy(true); setErr('');
    const { data, error } = await db.rpc('raise_ticket', {
      p_category: 'medical_sos', p_title: 'MEDICAL SOS' + (loc ? ' · ' + loc : ''),
      p_description: note || null, p_location: loc || 'Location not given', p_priority: null,
    });
    setBusy(false);
    if (error) return setErr(msg(error));
    setDone(data);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-semibold text-emerald-800">Help is on the way</h1>
        <p className="text-sm text-emerald-700">The medical team and security have been alerted with your location.</p>
        <Link className="inline-block text-sm font-medium text-blue-700 underline" to={'/tenant/requests?open=' + done.id}>Track this emergency</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Emergency SOS</h1>
        <p className="text-sm text-slate-500">For medical emergencies. The medical room and security are alerted at once.</p>
      </div>
      <input className={inp} placeholder="Where are you? (floor, unit, area)" value={loc} onChange={(e) => setLoc(e.target.value)} />
      <textarea className={inp} rows={3} placeholder="What is happening? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Notice>{err}</Notice>
      {!armed ? (
        <button onClick={() => setArmed(true)} className="h-32 w-full rounded-2xl bg-red-600 text-2xl font-bold text-white shadow-lg hover:bg-red-700">SOS - I need help</button>
      ) : (
        <div className="space-y-2 rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-center">
          <p className="font-semibold text-red-700">Send an emergency alert now?</p>
          <div className="flex gap-2">
            <button className={btn('danger') + ' flex-1'} disabled={busy} onClick={send}>{busy ? 'Sending...' : 'Yes, send SOS'}</button>
            <button className={btn('ghost')} onClick={() => setArmed(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}