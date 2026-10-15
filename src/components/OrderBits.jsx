import { QRCodeSVG } from 'qrcode.react';
import { Badge, cx } from './ui';
import { ORDER_LABEL, ORDER_TONE, ORDER_STEPS, STEP_SHORT, passUrl } from '../lib/food';

export function OrderBadge({ status }) {
  return <Badge tone={ORDER_TONE[status] || 'slate'}>{ORDER_LABEL[status] || status}</Badge>;
}

export function OrderProgress({ status }) {
  const idx = ORDER_STEPS.indexOf(status);
  if (idx < 0) return null;
  return (
    <div className="flex items-start">
      {ORDER_STEPS.map((s, i) => (
        <div key={s} className="relative flex-1 flex flex-col items-center">
          <div className={cx('h-3 w-3 rounded-full z-10', i <= idx ? 'bg-blue-600' : 'bg-slate-200')} />
          {i < ORDER_STEPS.length - 1 && (
            <div className={cx('absolute top-[5px] left-1/2 h-0.5 w-full', i < idx ? 'bg-blue-600' : 'bg-slate-200')} />
          )}
          <div className={cx('mt-1.5 text-[10px] text-center leading-tight', i <= idx ? 'text-blue-700 font-medium' : 'text-slate-400')}>
            {STEP_SHORT[s]}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PassCard({ pass }) {
  if (!pass) return null;
  const until = new Date(pass.valid_to).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-2.5">
      <div className="bg-white p-1 rounded"><QRCodeSVG value={passUrl(pass.token)} size={72} /></div>
      <div className="text-xs">
        <div className="font-semibold text-blue-900">Runner pass</div>
        <div className="text-slate-600">Hand-over only at <b>{pass.zone}</b></div>
        <div className="text-slate-500">Valid until {until}</div>
        <div className="font-mono text-[11px] text-slate-400">{pass.token}</div>
      </div>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 'text-2xl' }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange && onChange(n)}
          className={cx(size, n <= value ? 'text-amber-400' : 'text-slate-300', onChange && 'hover:scale-110 transition')}>★</button>
      ))}
    </div>
  );
}