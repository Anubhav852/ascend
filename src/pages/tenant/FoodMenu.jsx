import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, PageHeader, Button, Spinner, EmptyState, Badge, cx } from '../../components/ui';
import { money } from '../../lib/food';

export default function FoodMenu() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState(null);
  const [outletId, setOutletId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [carts, setCarts] = useState({});
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('outlets').select('id,name,kind,location').in('kind', ['restaurant', 'cafe']).order('name');
      setOutlets(data || []);
      if (data?.length) setOutletId((data.find((o) => o.id === 'out_deck') || data[0]).id);
      if (profile.tenant_id) {
        const { data: t } = await supabase.from('tenants').select('floor,units').eq('id', profile.tenant_id).maybeSingle();
        if (t) setLocation([t.floor ? `Floor ${t.floor}` : null, t.units].filter(Boolean).join(' · '));
      }
    })();
  }, [profile.tenant_id]);

  useEffect(() => {
    if (!outletId) return;
    setMenu(null);
    supabase.from('menu_items').select('*').eq('outlet_id', outletId).order('section').order('name')
      .then(({ data }) => setMenu(data || []));
  }, [outletId]);

  const cart = carts[outletId] || {};
  const setQty = (id, d) => setCarts((c) => {
    const cur = { ...(c[outletId] || {}) };
    const q = Math.max(0, (cur[id] || 0) + d);
    if (q === 0) delete cur[id]; else cur[id] = q;
    return { ...c, [outletId]: cur };
  });

  const lines = (menu || []).filter((m) => cart[m.id] > 0);
  const total = lines.reduce((s, m) => s + Number(m.price) * cart[m.id], 0);
  const outlet = outlets?.find((o) => o.id === outletId);

  const sections = [];
  (menu || []).forEach((m) => {
    let s = sections.find((x) => x.name === (m.section || 'Other'));
    if (!s) { s = { name: m.section || 'Other', items: [] }; sections.push(s); }
    s.items.push(m);
  });

  const place = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('place_order', {
      p_outlet: outletId,
      p_items: lines.map((l) => ({ item_id: l.id, qty: cart[l.id] })),
      p_location: location || null,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setCarts((c) => ({ ...c, [outletId]: {} }));
    navigate('/tenant/orders');
  };

  if (!outlets) return <Spinner />;

  return (
    <>
      <PageHeader title="Order food & coffee" subtitle="Delivered to your desk. The charge goes to your company account." />
      <div className="mb-4 flex flex-wrap gap-2">
        {outlets.map((o) => (
          <button key={o.id} onClick={() => setOutletId(o.id)}
            className={cx('rounded-full border px-4 py-1.5 text-sm', o.id === outletId ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white hover:border-blue-400')}>
            {o.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {outlet && <div className="text-xs text-slate-500">{outlet.location}</div>}
          {menu === null ? <Spinner /> : menu.length === 0 ? <EmptyState title="Menu not available" /> : sections.map((s) => (
            <Card key={s.name}>
              <div className="border-b px-4 py-2.5 font-semibold">{s.name}</div>
              <div className="divide-y">
                {s.items.map((m) => (
                  <div key={m.id} className={cx('flex items-center justify-between gap-3 px-4 py-3', !m.available && 'opacity-50')}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{m.name} {!m.available && <Badge tone="slate">Sold out</Badge>}</div>
                      {m.description && <div className="text-xs text-slate-500">{m.description}</div>}
                      <div className="text-sm text-blue-700 font-semibold mt-0.5">{money(m.price)}</div>
                    </div>
                    {m.available && (
                      cart[m.id] ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQty(m.id, -1)} className="h-7 w-7 rounded-full border border-blue-300 text-blue-700">−</button>
                          <span className="w-5 text-center text-sm font-semibold">{cart[m.id]}</span>
                          <button onClick={() => setQty(m.id, 1)} className="h-7 w-7 rounded-full bg-blue-600 text-white">+</button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setQty(m.id, 1)}>Add</Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div>
          <Card className="p-4 lg:sticky lg:top-4">
            <div className="font-semibold mb-3">Your order</div>
            {lines.length === 0 ? <div className="text-sm text-slate-400 py-4">Nothing added yet.</div> : (
              <div className="space-y-1.5 mb-3">
                {lines.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{cart[l.id]} × {l.name}</span><span>{money(Number(l.price) * cart[l.id])}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{money(total)}</span></div>
              </div>
            )}
            <label className="text-xs font-medium text-slate-600">Deliver to</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. 4th floor · Unit 401"
              className="mt-1 mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />            <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Less spicy, no sugar…"
              className="mt-1 mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {err && <div className="mb-2 text-xs text-red-600">{err}</div>}
            <Button className="w-full" disabled={!lines.length || busy} onClick={place}>
              {busy ? 'Placing…' : `Place order${lines.length ? ' · ' + money(total) : ''}`}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}