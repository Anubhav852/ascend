import { useCallback, useEffect, useRef, useState } from 'react';
import { db, useAuth, reqRef } from '../lib/req';
import { ROLES } from '../config/roles';

const IN_PANEL = typeof window !== 'undefined' && window.name === 'ascend-panel';
const WIDTH = 460;
const SPECIAL = { parking: '/staff/parking', events: '/staff/events', fnb: '/staff/orders', coffee: '/staff/orders' };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

function resolve(d) {
  let role, to;
  if (d.vendor) {
    role = ROLES.find((r) => r.portal === 'vendor' && r.vendor_id === d.vendor);
    to = '/vendor/work?open=' + d.id;
  } else if (d.outlet_id) {
    role = ROLES.find((r) => r.portal === 'outlet' && r.outlet_id === d.outlet_id);
    to = '/outlet/orders';
  } else {
    role = ROLES.find((r) => r.portal === 'staff' && r.team === d.team);
    to = SPECIAL[d.team] || '/staff/queue?open=' + d.id;
  }
  if (!role) return null;
  return { role, to, label: (d.ref ? reqRef(d.ref) + ' · ' : '') + (d.title || '') };
}

function Inner() {
  const { profile } = useAuth();
  const [multi, setMulti] = useState(null);
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [auto, setAuto] = useState(lsGet('ascend_panel_auto', '1') === '1');
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const pending = useRef([]);
  const timer = useRef(null);

  const show = useCallback((t) => {
    if (!t) return;
    setTarget(t);
    setNonce((n) => n + 1);
    if (autoRef.current) { setOpen(true); setPulse(false); } else setPulse(true);
  }, []);

  // categories that notify two teams (for example SOS) never open the panel
  useEffect(() => {
    db.from('category_routes').select('category,also_team')
      .then(({ data }) => setMulti(new Set((data || []).filter((x) => x.also_team).map((x) => x.category))));
  }, []);

  useEffect(() => { setOpen(false); setTarget(null); }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !multi) return undefined;
    const me = profile.id;
    const ch = db.channel('handoff-' + me + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets', filter: 'requester_id=eq.' + me }, (p) => {
        pending.current.push(p.new);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const rows = pending.current;
          pending.current = [];
          const r = rows[0];
          if (rows.length !== 1 || r.source !== 'user' || r.parent_id || multi.has(r.category)) return;
          show(resolve({ id: r.id, ref: r.ref, title: r.title, outlet_id: r.outlet_id, team: r.team }));
        }, 1200);
      })
      .subscribe();
    return () => { clearTimeout(timer.current); db.removeChannel(ch); };
  }, [profile?.id, multi, show]);

  useEffect(() => {
    const h = (e) => show(resolve(e.detail || {}));
    window.addEventListener('ascend:handoff', h);
    return () => window.removeEventListener('ascend:handoff', h);
  }, [show]);

  useEffect(() => {
    const push = open && window.innerWidth >= 1100;
    document.body.classList.toggle('hp-push', push);
    document.body.style.paddingRight = push ? WIDTH + 'px' : '';
    return () => { document.body.classList.remove('hp-push'); document.body.style.paddingRight = ''; };
  }, [open]);

  const src = target ? '/panel?as=' + target.role.code + '&to=' + encodeURIComponent(target.to) : '';

  return (
    <>
      <style>{'body.hp-push .fixed.inset-0.z-50 { right: ' + WIDTH + 'px !important; }'}</style>
      {open && target && (
        <aside className="fixed right-0 top-0 z-[60] flex h-full max-w-[92vw] flex-col border-l border-slate-300 bg-white shadow-2xl" style={{ width: WIDTH }}>
          <div className="flex items-center justify-between gap-2 bg-blue-900 px-3 py-2 text-white">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-blue-200">Receiving portal · reviewer view</div>
              <div className="truncate text-sm font-semibold">{target.role.code + ' · ' + target.role.label}</div>
              <div className="truncate text-xs text-blue-200">{target.role.full_name + ' · ' + target.label}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-blue-100">
                <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); lsSet('ascend_panel_auto', e.target.checked ? '1' : '0'); }} />
                Auto-open
              </label>
              <button title="Reload" className="rounded px-2 py-1 text-sm hover:bg-blue-800" onClick={() => setNonce((n) => n + 1)}>{'\u21bb'}</button>
              <button title="Close" className="rounded px-2 py-1 text-sm hover:bg-blue-800" onClick={() => setOpen(false)}>{'\u2715'}</button>
            </div>
          </div>
          <iframe key={nonce} name="ascend-panel" title="Receiving portal" src={src} className="h-full w-full flex-1 border-0" />
        </aside>
      )}
      {!open && target && (
        <button onClick={() => { setOpen(true); setPulse(false); }}
          className={'fixed bottom-4 right-4 z-[60] rounded-full bg-blue-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-800 ' + (pulse ? 'animate-pulse' : '')}>
          {target.role.code + ' · ' + (pulse ? 'new request waiting' : 'show receiving portal')}
        </button>
      )}
    </>
  );
}

export default function HandoffPanel() {
  if (IN_PANEL) return null;
  return <Inner />;
}