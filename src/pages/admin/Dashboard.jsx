import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { TEAMS } from '../../config/roles';
import { Card, Stat, PageHeader, StatusBadge, PriorityBadge, Spinner, EmptyState, Button } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { reqRef } from '../../lib/labels';

const OPEN = ['raised', 'routed', 'accepted', 'in_progress', 'on_hold', 'escalated'];
const LIVE_ORDERS = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
const count = (q) => q.then(({ count: c }) => c ?? 0);

export default function Dashboard() {
  const [k, setK] = useState(null);
  const [teams, setTeams] = useState([]);
  const [recent, setRecent] = useState([]);

  const load = useCallback(async () => {
    const head = { count: 'exact', head: true };
    const now = new Date().toISOString();
    const [open, critical, breached, total, passes, orders, busyBays, bays, openRows, rec] = await Promise.all([
      count(supabase.from('tickets').select('id', head).in('status', OPEN)),
      count(supabase.from('tickets').select('id', head).in('status', OPEN).eq('priority', 'critical')),
      count(supabase.from('tickets').select('id', head).in('status', OPEN).lt('sla_due', now)),
      count(supabase.from('tickets').select('id', head)),
      count(supabase.from('passes').select('id', head).eq('status', 'active')),
      count(supabase.from('orders').select('id', head).in('status', LIVE_ORDERS)),
      count(supabase.from('parking_bays').select('id', head).in('status', ['occupied', 'reserved'])),
      count(supabase.from('parking_bays').select('id', head)),
      supabase.from('tickets').select('team').in('status', OPEN).limit(1000),
      supabase.from('tickets').select('id,ref,title,team,status,priority,created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    setK({ open, critical, breached, total, passes, orders, busyBays, bays });
    const by = {};
    (openRows.data || []).forEach((r) => { by[r.team] = (by[r.team] || 0) + 1; });
    setTeams(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8));
    setRecent(rec.data || []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-dash-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (!k) return <Spinner />;
  const max = Math.max(1, ...teams.map((t) => t[1]));

  return (
    <>
      <PageHeader title="Building overview" subtitle="Live from the shared request engine"
        actions={<Link to="/admin/portals"><Button>Open User Portals →</Button></Link>} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Stat label="Open requests" value={k.open} hint={`${k.total} total`} />
        <Stat label="Urgent open" value={k.critical} tone={k.critical ? 'red' : 'green'} />
        <Stat label="SLA breached" value={k.breached} tone={k.breached ? 'amber' : 'green'} />
        <Stat label="Live food orders" value={k.orders} />
        <Stat label="Active passes" value={k.passes} hint="visitor, parking, vendor, delivery" />
        <Stat label="Parking in use" value={`${k.busyBays}/${k.bays}`} hint="occupied or reserved bays" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="border-b px-4 py-3 font-semibold">Open requests by team</div>
          <div className="p-4 space-y-2.5">
            {teams.length === 0 && <EmptyState title="Nothing open" />}
            {teams.map(([t, n]) => (
              <div key={t}>
                <div className="flex justify-between text-xs mb-0.5"><span>{TEAMS[t] || t}</span><b>{n}</b></div>
                <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-blue-600" style={{ width: `${(n / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b px-4 py-3 font-semibold">Latest requests</div>
          {recent.length === 0 ? <EmptyState title="No requests yet" /> : (
            <div className="divide-y">
              {recent.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate"><span className="text-slate-400 mr-2">{reqRef(t.ref)}</span>{t.title}</div>
                    <div className="text-xs text-slate-500">{TEAMS[t.team] || t.team} · {timeAgo(t.created_at)}</div>
                  </div>
                  <div className="flex gap-1.5"><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}