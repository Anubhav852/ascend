import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../lib/format';

const LEVEL = { info: 'border-blue-400', warning: 'border-amber-400', critical: 'border-red-500' };

export default function NotificationBell() {
  const { profile } = useAuth();
  const uid = profile?.id;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(25);
    setItems(data || []);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
    const ch = supabase.channel('notif-' + uid + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, load]);

  const unread = items.filter((n) => !n.read).length;
  const markAll = async () => { await supabase.rpc('mark_all_read'); load(); };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-full p-2 text-blue-100 hover:bg-blue-800" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="font-semibold text-sm">Notifications</span>
              <button onClick={markAll} disabled={!unread} className="text-xs text-blue-600 disabled:text-slate-300">Mark all read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && <div className="p-6 text-center text-sm text-slate-400">Nothing yet</div>}
              {items.map((n) => (
                <div key={n.id} className={`border-l-4 px-4 py-2.5 border-b border-b-slate-100 ${LEVEL[n.level] || LEVEL.info} ${n.read ? 'opacity-60' : 'bg-blue-50/50'}`}>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-slate-500">{n.body}</div>}
                  <div className="text-[11px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}