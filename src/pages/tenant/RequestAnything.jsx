import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, msg, teamName } from '../../lib/req';
import { Notice, inp, btn } from '../../components/ReqBits';

const SKIP = ['food', 'coffee', 'parking', 'visitor', 'event', 'ev', 'carwash', 'medical_sos'];
const KEYS = {
  hvac: 'ac air conditioner conditioning cold hot warm temperature cooling fan',
  electrical: 'light lights lamp power socket switch electric electricity tripped fuse',
  plumbing: 'leak leaking water tap toilet flush drain pipe flooding',
  maintenance: 'broken repair fix door window chair desk table paint ceiling',
  it_wifi: 'wifi wi-fi internet network slow laptop printer connection',
  av: 'projector screen conference display camera microphone video meeting',
  it_provision: 'new internet broadband line connection install',
  housekeeping: 'clean cleaning dust spill dirty washroom pantry',
  laundry: 'laundry iron ironing clothes wash',
  waste: 'garbage trash waste bin dustbin cardboard',
  ewaste: 'ewaste e-waste old monitors electronics',
  pest: 'pest cockroach ants rat insects mosquito',
  printing: 'print printing scan copy photocopy stationery',
  concierge: 'cab taxi errand booking assist help',
  valet: 'valet car keys',
  creche: 'creche child kids baby',
  signage: 'signage advert ad display poster',
  shuttle: 'shuttle bus pool ride',
  wellness: 'gym yoga wellness fitness',
  fitout: 'fitout fit-out move renovation contractor interior',
};
const mins = (m) => (m >= 1440 ? Math.round(m / 1440) + ' day(s)' : m >= 60 ? Math.round(m / 60) + ' hour(s)' : m + ' min');
const lbl = 'mb-1 block text-sm font-medium text-slate-700';

export default function RequestAnything() {
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [locs, setLocs] = useState([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    db.from('category_routes').select('*').eq('tenant_facing', true).order('label')
      .then(({ data }) => setCats((data || []).filter((c) => !SKIP.includes(c.category))));
    db.from('locations').select('name').order('name').then(({ data }) => setLocs((data || []).map((l) => l.name)));
  }, []);

  const guess = useMemo(() => {
    const words = search.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
    if (!words.length) return [];
    return cats
      .map((c) => {
        const keys = ((KEYS[c.category] || '') + ' ' + c.label.toLowerCase()).split(' ').filter((w) => w.length > 1);
        const n = keys.filter((w) => words.some((x) => x === w || (w.length > 3 && x.startsWith(w)) || (x.length > 3 && w.startsWith(x)))).length;
        return { c, n };
      })
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3).map((x) => x.c);
  }, [search, cats]);

  const pick = (c) => { setCat(c); setTitle(c.label); setDesc(search.trim()); };
  const submit = async () => {
    setBusy(true); setErr('');
    const { data, error } = await db.rpc('raise_ticket', {
      p_category: cat.category, p_title: title.trim(), p_description: desc.trim() || null,
      p_location: loc.trim() || null, p_priority: urgent ? 'high' : null,
    });
    setBusy(false);
    if (error) return setErr(msg(error));
    nav('/tenant/requests?open=' + data.id);
  };

  if (cat) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <button className="text-sm text-blue-600" onClick={() => setCat(null)}>← Choose a different type</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">{cat.label}</h1>
          <p className="mb-4 text-sm text-slate-500">{'Goes to ' + teamName(cat.team) + ' · target response ' + mins(cat.sla_minutes)}</p>
          <div className="space-y-3">
            <div><label className={lbl}>What do you need?</label><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className={lbl}>More detail (optional)</label><textarea className={inp} rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div>
              <label className={lbl}>Where? (floor, unit or area)</label>
              <input className={inp} list="locs" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Unit 401" />
              <datalist id="locs">{locs.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Needs quick attention
            </label>
            <Notice>{err}</Notice>
            <button className={btn()} disabled={busy || !title.trim()} onClick={submit}>{busy ? 'Sending...' : 'Send request'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Request anything</h1>
        <p className="text-sm text-slate-500">Describe what you need and we will point you to the right team, or pick from the list.</p>
      </div>
      <input className={inp} placeholder="e.g. the AC is too cold near my desk" value={search} onChange={(e) => setSearch(e.target.value)} />
      {guess.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Looks like:</span>
          {guess.map((c) => <button key={c.category} onClick={() => pick(c)} className="rounded-full bg-blue-600 px-3 py-1 text-white">{c.label}</button>)}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <button key={c.category} onClick={() => pick(c)} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-400 hover:shadow">
            <div className="font-medium text-slate-900">{c.label}</div>
            <div className="text-xs text-slate-500">{'Goes to ' + teamName(c.team)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}