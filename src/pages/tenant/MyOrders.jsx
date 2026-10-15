import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, PageHeader, Button, Spinner, EmptyState } from '../../components/ui';
import { OrderBadge, OrderProgress, PassCard, Stars } from '../../components/OrderBits';
import { money, orderNo } from '../../lib/food';
import { timeAgo } from '../../lib/format';

function OrderCard({ o, pass, fb, charge, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const act = async (status) => {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('advance_order', { p_order: o.id, p_status: status });
    setBusy(false);
    if (error) setErr(error.message); else onChanged();
  };
  const rate = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('submit_feedback', { p_ticket: o.ticket_id, p_rating: rating, p_comment: comment || null });
    setBusy(false);
    if (error) setErr(error.message); else onChanged();
  };

  const active = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{o.outlet?.name}</div>
          <div className="text-xs text-slate-500">{orderNo(o.ticket?.ref)} · {timeAgo(o.created_at)} · {o.delivery_location || 'No location'}</div>
        </div>
        <OrderBadge status={o.status} />
      </div>

      {active && <div className="mt-4"><OrderProgress status={o.status} /></div>}
      {active && o.eta_minutes && <div className="mt-2 text-xs text-blue-700">Estimated ready in about {o.eta_minutes} min</div>}

      <div className="mt-3 text-sm text-slate-700">
        {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{money(i.price * i.qty)}</span></div>)}
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
          <span>Total {charge && <span className="ml-1 text-xs font-normal text-slate-400">· {charge.status === 'billed' ? 'billed to company' : 'to be billed'}</span>}</span>
          <span>{money(o.total)}</span>
        </div>
      </div>

      {pass && <div className="mt-3"><PassCard pass={pass} /></div>}

      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {['placed', 'accepted'].includes(o.status) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('cancelled')}>Cancel order</Button>}
        {['ready', 'out_for_delivery'].includes(o.status) && <Button size="sm" disabled={busy} onClick={() => act('delivered')}>I received it</Button>}
      </div>

      {o.status === 'delivered' && (
        fb ? (
          <div className="mt-3 flex items-center gap-2 text-sm"><span className="text-slate-500">Your rating</span><Stars value={fb.rating} size="text-lg" /></div>
        ) : (
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-sm font-medium mb-1">How was it?</div>
            <Stars value={rating} onChange={setRating} />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <Button size="sm" className="mt-2" disabled={!rating || busy} onClick={rate}>Submit rating</Button>
          </div>
        )
      )}
    </Card>
  );
}

export default function MyOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState(null);
  const [extra, setExtra] = useState({ passes: {}, fb: {}, charges: {} });

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('*, outlet:outlets(name), ticket:tickets(ref)')
      .eq('requester_id', profile.id).order('created_at', { ascending: false }).limit(30);
    const list = data || [];
    setOrders(list);
    if (!list.length) return;
    const tids = list.map((o) => o.ticket_id);
    const [p, f, c] = await Promise.all([
      supabase.from('passes').select('*').in('ticket_id', tids).eq('kind', 'food_delivery').eq('status', 'active'),
      supabase.from('feedback').select('*').in('ticket_id', tids),
      supabase.from('charges').select('source_id,status').eq('source_type', 'order').in('source_id', list.map((o) => o.id)),
    ]);
    const by = (rows, key) => Object.fromEntries((rows.data || []).map((r) => [r[key], r]));
    setExtra({ passes: by(p, 'ticket_id'), fb: by(f, 'ticket_id'), charges: by(c, 'source_id') });
  }, [profile.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel('myorders-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <>
      <PageHeader title="My orders" subtitle="Status updates appear live as the kitchen works on your order."
        actions={<Link to="/tenant/food"><Button>+ New order</Button></Link>} />
      {orders === null ? <Spinner /> : orders.length === 0 ? (
        <Card><EmptyState title="No orders yet" hint="Order food or coffee to see it here." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} pass={extra.passes[o.ticket_id]} fb={extra.fb[o.ticket_id]} charge={extra.charges[o.id]} onChanged={load} />
          ))}
        </div>
      )}
    </>
  );
}