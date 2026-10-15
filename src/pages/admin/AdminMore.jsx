import { Link } from 'react-router-dom';

const GROUPS = [
  ['Operations', [['/admin/parking', 'Parking desk', 'Allocate bays, live map, expiry check'], ['/admin/reception', 'Visitors', 'Walk-ins and who is on site'], ['/admin/gate', 'Gate scanner', 'Scan any active pass'], ['/admin/events', 'Event approvals', 'Approve events, creates 5 linked tasks'], ['/admin/stock', 'Stock', 'Levels and low-stock alerts'], ['/admin/parcels', 'Parcels', 'Mailroom and PIN handover']]],
  ['Governance', [['/admin/audit', 'Audit log', 'Who did what and when'], ['/admin/roles', 'Roles matrix', 'Every role, scope and page'], ['/admin/compliance', 'Compliance', 'Health checks and certificates']]],
];

export default function AdminMore() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-slate-900">More tools</h1><p className="text-sm text-slate-500">Everything else in the management console</p></div>
      {GROUPS.map(([g, items]) => (
        <div key={g}>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(([to, t, s]) => (
              <Link key={to} to={to} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow">
                <div className="font-medium text-slate-900">{t}</div><div className="text-xs text-slate-500">{s}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}