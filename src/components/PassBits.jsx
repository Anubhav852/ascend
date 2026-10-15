import { useEffect, useState } from 'react';
import * as QR from 'qrcode.react';

const QRC = QR.QRCodeSVG || QR.default;

export const passLink = (token) => window.location.origin + '/pass/' + token;
export const when = (ts) => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return n;
}

export function left(validTo, now) {
  const s = Math.floor((new Date(validTo) - now) / 1000);
  if (s <= 0) return 'expired';
  const m = Math.floor(s / 60);
  if (m >= 120) return Math.floor(m / 60) + ' h';
  return m + ':' + String(s % 60).padStart(2, '0');
}

export function PassQR({ token, size = 120 }) {
  if (!QRC) return null;
  return (
    <div className="inline-block rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
      <QRC value={passLink(token)} size={size} />
    </div>
  );
}

export const PASS_TONE = {
  active: 'bg-emerald-100 text-emerald-700',
  used: 'bg-slate-100 text-slate-600',
  expired: 'bg-amber-100 text-amber-800',
  revoked: 'bg-red-100 text-red-700',
};