import * as sb from './supabase';
import * as AC from '../context/AuthContext';
import { TEAMS } from '../config/roles';

export const db = sb.supabase || sb.default;
export const useAuth = AC.useAuth;
export { TEAMS };

export const STATUS = {
  raised: ['Submitted', 'bg-slate-100 text-slate-700'],
  routed: ['Sent to team', 'bg-blue-100 text-blue-700'],
  accepted: ['Accepted', 'bg-indigo-100 text-indigo-700'],
  in_progress: ['In progress', 'bg-amber-100 text-amber-800'],
  on_hold: ['On hold', 'bg-slate-200 text-slate-700'],
  escalated: ['Escalated', 'bg-red-100 text-red-700'],
  fulfilled: ['Completed', 'bg-emerald-100 text-emerald-700'],
  closed: ['Closed', 'bg-emerald-50 text-emerald-700'],
  rejected: ['Declined', 'bg-rose-100 text-rose-700'],
  cancelled: ['Cancelled', 'bg-slate-100 text-slate-500'],
  expired: ['Expired', 'bg-slate-100 text-slate-500'],
};
export const PRIORITY = {
  critical: ['Urgent', 'bg-red-600 text-white'],
  high: ['High', 'bg-orange-100 text-orange-800'],
  normal: ['Normal', 'bg-slate-100 text-slate-600'],
  low: ['Low', 'bg-slate-50 text-slate-500'],
};
export const OPEN = ['raised', 'routed', 'accepted', 'in_progress', 'on_hold', 'escalated'];

export const reqRef = (r) => (r || '').replace('TKT-', 'REQ-');
export const teamName = (t) => TEAMS[t] || t || '-';
export const msg = (e) => (e && e.message) || String(e);

export function ago(ts) {
  const s = Math.max(1, Math.round((Date.now() - new Date(ts)) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

export function due(t) {
  if (!t.sla_due || !OPEN.includes(t.status)) return null;
  const m = Math.round((new Date(t.sla_due) - Date.now()) / 60000);
  const a = Math.abs(m);
  const txt = a >= 1440 ? Math.round(a / 1440) + 'd' : a >= 60 ? Math.round(a / 60) + 'h' : a + 'm';
  return m < 0 ? { text: 'Overdue ' + txt, late: true } : { text: 'Due in ' + txt, late: false };
}