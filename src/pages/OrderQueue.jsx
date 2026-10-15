import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { TEAMS } from '../config/roles';
import { Card, PageHeader, Button, Spinner, Stat } from '../components/ui';
import { OrderBadge, PassCard, Stars } from '../components/OrderBits';
import { money, orderNo } from '../lib/food';
import { timeAgo } from '../lib/format';

function QueueCard({ o, pass, fb, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [eta, setEta] = useState(15);

  const act = async (status, withEta) => {
    setBusy(true); setErr('');
    const args = { p_order: o.id, p_status: status };
    if (withEta) args.p_eta = Number(eta);
    const { error } = await supabase.rpc('advance_order', args);
    setBusy(false);
    if (error) setErr(error.message); else onChanged();
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{orderNo(o.ticket?.ref)} <span className="font-normal text-slate-500">· {o.outlet?.name}</span></div>
          <div className="text-xs text-slate-500">{o.requester?.full_name}{o.tenant?.name ? ` · ${o.tenant.name}` : ''}</div>
          <div className="text-xs text-slate-500">📍 {o.delivery_location || 'No location'} · {timeAgo(o.created_at)}</div>
        </div>
        <OrderBadge status={o.status} />
      </div>
      <div className="mt-2 text-sm">
        {o.items.map((i, k) => <div key={k}>{i.qty} × {i.name}</div>)}
        <div className="mt-1 text-xs text-slate-500">Total {money(o.total)}{o.eta_minutes ? ` · ETA ${o.eta_minutes} min` : ''}</div>
      </div>
      {pass && <div className="mt-2"><PassCard pass={pass} /></div>}
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {o.status === 'placed' && (<>
          <select value={eta} onChange={(e) => setEta(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
            {[10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <Button size="sm" disabled={busy} onClick={() => act('accepted', true)}>Accept</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => act('rejected')}>Decline</Button>
        </>)}
        {o.status === 'accepted' && <Button size="sm" disabled={busy} onClick={() => act('preparing')}>Start preparing</Button>}
        {o.status === 'preparing' && <Button size="sm" disabled={busy} onClick={() => act('ready')}>Mark ready</Button>}
        {o.status === 'ready' && (<>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('out_for_delivery')}>Out for delivery</Button>
          <Button size="sm" disabled={busy} onClick={() => act('delivered')}>Handed over</Button>
        </>)}
        {o.status === 'out_for_delivery' && <Button size="sm" disabled={busy} onClick={() => act('delivered')}>Handed over</Button>}
        {fb && <div className="flex items-center gap-1 text-xs text-slate-500">Rated <Stars value={fb.rating} size="text-base" /></div>}
      </div>
    </Card>
  );
}

function Column({ title, tone, children, count }) {
  return (
    <div className="rounded-xl bg-slate-100/70 p-2">
      <div className="flex items-center justify-between px-1.5 py-1.5">
        <span className={`text-sm font-semibold ${tone}`}>{title}</span>
        <span className="rounded-full bg-white px-2 text-xs text-slate-500">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function OrderQueue() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState(null);
  const [extra, setExtra] = useState({ passes: {}, fb: {} });

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('*, requester:profiles(full_name), tenant:tenants(name), outlet:outlets(name), ticket:tickets(ref)')
      .order('created_at', { ascending: false }).limit(100);
    const list = data || [];
    setOrders(list);
    if (!list.length) return;
    const tids = list.map((o) => o.ticket_id);
    const [p, f] = await Promise.all([
      supabase.from('passes').select('*').in('ticket_id', tids).eq('kind', 'food_delivery').eq('status', 'active'),
      supabase.from('feedback').select('*').in('ticket_id', tids),
    ]);
    const by = (rows) => Object.fromEntries((rows.data || []).map((r) => [r.ticket_id, r]));
    setExtra({ passes: by(p), fb: by(f) });
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('queue-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (!orders) return <Spinner />;

  const oldest = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  const fresh = orders.filter((o) => o.status === 'placed').sort(oldest);
  const kitchen = orders.filter((o) => ['accepted', 'preparing'].includes(o.status)).sort(oldest);
  const ready = orders.filter((o) => ['ready', 'out_for_delivery'].includes(o.status)).sort(oldest);
  const done = orders.filter((o) => ['delivered', 'cancelled', 'rejected'].includes(o.status)).slice(0, 8);

  const render = (list) => list.map((o) => (
    <QueueCard key={o.id} o={o} pass={extra.passes[o.ticket_id]} fb={extra.fb[o.ticket_id]} onChanged={load} />
  ));
  const who = profile.portal === 'staff' ? TEAMS[profile.team] : profile.portal === 'admin' ? 'All outlets' : 'Your outlet';

  return (
    <>
      <PageHeader title="Order queue" subtitle={`${who} · updates live`} />
      <div className="grid gap-3 grid-cols-3 mb-5">
        <Stat label="New" value={fresh.length} tone={fresh.length ? 'amber' : 'green'} />
        <Stat label="In kitchen" value={kitchen.length} />
        <Stat label="Ready / on the way" value={ready.length} />
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <Column title="New orders" tone="text-amber-700" count={fresh.length}>{render(fresh)}</Column>
        <Column title="In kitchen" tone="text-violet-700" count={kitchen.length}>{render(kitchen)}</Column>
        <Column title="Ready & delivery" tone="text-blue-700" count={ready.length}>{render(ready)}</Column>
        <Column title="Recently finished" tone="text-slate-600" count={done.length}>{render(done)}</Column>
      </div>
    </>
  );
}