import { statusLabel, priorityLabel } from '../lib/labels';
export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', className, ...p }) {
  const v = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50',
    ghost: 'text-blue-700 hover:bg-blue-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  const s = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }[size];
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)}
      {...p}
    />
  );
}

export function Card({ className, children, ...p }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...p}>{children}</div>;
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-100 text-blue-800', green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', violet: 'bg-violet-100 text-violet-800',
};
export function Badge({ tone = 'slate', className, children }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

const STATUS_TONE = {
  raised: 'slate', routed: 'blue', accepted: 'blue', in_progress: 'violet', fulfilled: 'green', closed: 'green',
  rejected: 'red', cancelled: 'slate', expired: 'slate', on_hold: 'amber', escalated: 'red',
};
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'slate'}>{statusLabel(status)}</Badge>;
}
const PRIO_TONE = { low: 'slate', normal: 'blue', high: 'amber', critical: 'red' };
export function PriorityBadge({ priority }) {
  return <Badge tone={PRIO_TONE[priority] || 'slate'}>{priorityLabel(priority)}</Badge>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> {label}
    </div>
  );
}
export function FullPageSpinner() {
  return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-10 text-slate-500">
      <div className="font-medium text-slate-700">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = 'blue', hint }) {
  const c = { blue: 'text-blue-700', red: 'text-red-600', amber: 'text-amber-600', green: 'text-emerald-600' }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-1 text-3xl font-bold', c)}>{value ?? '–'}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}