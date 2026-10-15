import { useState } from 'react';
import * as QR from 'qrcode.react';
import { db } from '../lib/req';
import { inp, btn } from './ReqBits';

const QRC = QR.QRCodeSVG || QR.default;

export const Info = ({ k, v }) => (
  <div><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>
);

export function ParcelBox({ t, mine, isOpen }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
      <div>Locker: <b>{t.meta?.locker}</b> · Courier: <b>{t.meta?.courier}</b></div>
      {mine && isOpen && (
        <div className="mt-2">Your collection PIN:{' '}
          <span className="rounded bg-white px-2 py-0.5 font-mono text-lg font-bold tracking-widest">{t.meta?.pin}</span>
        </div>
      )}
    </div>
  );
}

export function PermitBox({ pass }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
      {QRC && <QRC value={window.location.origin + '/pass/' + pass.token} size={84} />}
      <div className="text-sm">
        <div className="font-semibold text-slate-800">Work permit and entry pass</div>
        <div className="text-slate-600">{'Permit ' + (pass.meta?.permit || '') + ' · ' + (pass.zone || '')}</div>
        <div className="text-xs text-slate-500">{'Valid until ' + new Date(pass.valid_to).toLocaleString() + ' · ' + pass.status}</div>
      </div>
    </div>
  );
}

export function TenantActions({ t, fb, run, busy }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const set = (s, okMsg, kind, label) => (
    <button className={btn(kind)} disabled={busy}
      onClick={() => run(okMsg, () => db.rpc('set_ticket_status', { p_ticket: t.id, p_status: s, p_note: null }))}>{label}</button>
  );
  return (
    <div className="space-y-3">
      {['raised', 'routed', 'accepted', 'on_hold'].includes(t.status) && set('cancelled', 'Request cancelled', 'ghost', 'Cancel this request')}
      {t.status === 'fulfilled' && set('closed', 'Request closed', 'good', 'Close request')}
      {['fulfilled', 'closed'].includes(t.status) && !fb && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-medium text-slate-700">How did we do?</div>
          <div>{[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} className={'text-2xl ' + (n <= stars ? 'text-amber-400' : 'text-slate-300')}>★</button>
          ))}</div>
          <input className={inp} placeholder="Add a comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className={btn()} disabled={busy}
            onClick={() => run('Thanks for your feedback', () => db.rpc('submit_feedback', { p_ticket: t.id, p_rating: stars, p_comment: comment || null }))}>Submit rating</button>
        </div>
      )}
      {fb && <p className="text-sm text-slate-600">{'You rated this ' + fb.rating + ' / 5'}</p>}
    </div>
  );
}

export function VendorActions({ t, run, busy }) {
  const b = (s, label, kind) => (
    <button key={s} className={btn(kind)} disabled={busy || t.status === s}
      onClick={() => run(label + ' - done', () => db.rpc('set_ticket_status', { p_ticket: t.id, p_status: s, p_note: null }))}>{label}</button>
  );
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Your work order</div>
      <div className="flex flex-wrap gap-2">
        {b('accepted', 'Accept job', 'ghost')}{b('in_progress', 'Start work', 'ghost')}
        {b('on_hold', 'On hold', 'ghost')}{b('fulfilled', 'Work completed', 'good')}
      </div>
    </div>
  );
}