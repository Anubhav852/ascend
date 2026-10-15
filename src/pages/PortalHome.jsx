import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ROLES, PORTALS } from '../config/roles';
import { COMING } from '../config/nav';
import { Card, PageHeader, StatusBadge, PriorityBadge, Spinner, EmptyState, Badge } from '../components/ui';
import { timeAgo } from '../lib/format';
import { reqRef, listTitle } from '../lib/labels';

// Placeholder home for tenant / staff / outlet / vendor. Shows the tickets THIS role is allowed to see (row-level security).
export default function PortalHome() {
  const { profile } = useAuth();
  const role = ROLES.find((r) => r.code === profile.role_code);
  const portal = PORTALS.find((p) => p.id === profile.portal);
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('tickets')
      .select('id,ref,title,team,status,priority,location,created_at')
      .order('created_at', { ascending: false }).limit(10);
    setRows(data || []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('home-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <>
      <PageHeader title={`Welcome, ${profile.full_name}`} subtitle={role?.blurb || role?.label} />
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-4">
          <div className="text-xs uppercase text-slate-500">Role</div>
          <div className="mt-1 font-semibold">{profile.role_code} · {role?.label}</div>
          <Badge tone="blue" className="mt-2">{portal?.label}</Badge>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-slate-500">Scope</div>
          <div className="mt-1 text-sm">
            {profile.team && <>Team: <b>{profile.team}</b><br /></>}
            {profile.tenant_id && <>Tenant: <b>{profile.tenant_id}</b><br /></>}
            {profile.outlet_id && <>Outlet: <b>{profile.outlet_id}</b><br /></>}
            {profile.vendor_id && <>Vendor: <b>{profile.vendor_id}</b><br /></>}
            {!profile.team && !profile.tenant_id && !profile.outlet_id && !profile.vendor_id && 'Own records only'}
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="text-xs uppercase text-blue-700">Coming next</div>
          <div className="mt-1 text-sm text-blue-900">{COMING[profile.portal]}</div>
        </Card>
      </div>

      <Card>
        <div className="border-b px-4 py-3 font-semibold">{listTitle(profile.portal)} <span className="text-xs font-normal text-slate-400">- you only see what your role allows</span></div>
        {rows === null ? <Spinner /> : rows.length === 0 ? <EmptyState title="No requests yet" /> : (
          <div className="divide-y">
            {rows.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate"><span className="text-slate-400 mr-2">{reqRef(t.ref)}</span>{t.title}</div>
                  <div className="text-xs text-slate-500">{t.team} · {t.location || '—'} · {timeAgo(t.created_at)}</div>
                </div>
                <div className="flex gap-1.5"><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}