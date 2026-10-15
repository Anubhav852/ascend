import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, PageHeader, Button, Spinner, EmptyState, Badge } from '../../components/ui';
import { money } from '../../lib/food';

export default function MenuManager() {
  const { profile } = useAuth();
  const oid = profile.outlet_id;
  const [items, setItems] = useState(null);
  const [outlet, setOutlet] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', section: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('menu_items').select('*').eq('outlet_id', oid).order('section').order('name');
    setItems(data || []);
  }, [oid]);

  useEffect(() => {
    load();
    supabase.from('outlets').select('name,location').eq('id', oid).maybeSingle().then(({ data }) => setOutlet(data));
  }, [oid, load]);

  const run = async (promise) => {
    setErr('');
    const { error } = await promise;
    if (error) setErr(error.message);
    else load();
    return !error;
  };

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(supabase.from('menu_items').insert({
      outlet_id: oid, name: form.name.trim(), description: form.description.trim() || null,
      price: Number(form.price), section: form.section.trim() || 'Mains',
    }));
    if (ok) setForm({ name: '', description: '', price: '', section: form.section });
  };

  const sections = [...new Set((items || []).map((i) => i.section))];
  const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <PageHeader title="Menu manager" subtitle={outlet ? `${outlet.name} · ${outlet.location}` : ''} />
      {err && <div className="mb-4 rounded-lg bg-red-100 text-red-800 text-sm p-3">{err}</div>}

      <Card className="p-4 mb-5">
        <div className="font-semibold mb-3">Add an item</div>
        <form onSubmit={add} className="grid gap-2 md:grid-cols-12">
          <input required className={`${input} md:col-span-3`} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={`${input} md:col-span-4`} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input required type="number" min="1" step="1" className={`${input} md:col-span-2`} placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input list="sections" className={`${input} md:col-span-2`} placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          <Button type="submit" className="md:col-span-1">Add</Button>
        </form>
      </Card>

      {items === null ? <Spinner /> : items.length === 0 ? <Card><EmptyState title="No items yet" hint="Add your first item above." /></Card> : (
        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s}>
              <div className="border-b px-4 py-2.5 font-semibold">{s}</div>
              <div className="divide-y">
                {items.filter((i) => i.section === s).map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{m.name} {!m.available && <Badge tone="slate">Sold out</Badge>}</div>
                      <div className="text-xs text-slate-500">{m.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">₹</span>
                      <input type="number" min="1" defaultValue={m.price} key={m.id + m.price}
                        onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== Number(m.price)) run(supabase.from('menu_items').update({ price: v }).eq('id', m.id)); }}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm" />
                      <Button size="sm" variant="secondary" onClick={() => run(supabase.from('menu_items').update({ available: !m.available }).eq('id', m.id))}>
                        {m.available ? 'Mark sold out' : 'Back in stock'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(supabase.from('menu_items').delete().eq('id', m.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}