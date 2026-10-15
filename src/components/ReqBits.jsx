import { STATUS, PRIORITY, ago } from '../lib/req';

export const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
export const sel = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
export const btn = (kind = 'primary') => ({
  primary: 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50',
  ghost: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  danger: 'rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50',
  good: 'rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50',
}[kind]);

export const Pill = ({ cls, children }) => (
  <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' + cls}>{children}</span>
);
export const StatusPill = ({ s }) => {
  const [l, c] = STATUS[s] || [s, 'bg-slate-100 text-slate-600'];
  return <Pill cls={c}>{l}</Pill>;
};
export const PrioPill = ({ p }) => {
  const [l, c] = PRIORITY[p] || [p, 'bg-slate-100 text-slate-600'];
  return <Pill cls={c}>{l}</Pill>;
};

export function Notice({ kind = 'error', children }) {
  if (!children) return null;
  const c = kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <div className={'rounded-lg border px-3 py-2 text-sm ' + c}>{children}</div>;
}

export function Timeline({ events }) {
  if (!events.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="space-y-3 border-l-2 border-blue-100 pl-4">
      {events.map((e) => {
        const st = e.to_status ? (STATUS[e.to_status] ? STATUS[e.to_status][0] : e.to_status) : '';
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
            <div className="text-sm text-slate-800">{e.note || (st ? 'Status: ' + st : 'Update')}</div>
            <div className="text-xs text-slate-500">{(e.actor_name || 'System') + ' · ' + ago(e.created_at) + (e.note && st ? ' · ' + st : '')}</div>
          </li>
        );
      })}
    </ol>
  );
}