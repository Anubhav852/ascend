// Nav per role.
const HOME = (p) => ({ to: `/${p}`, label: 'Home', end: true });

export function navFor(profile) {
  switch (profile.portal) {
    case 'tenant': {
      const n = [
        HOME('tenant'),
        { to: '/tenant/requests/new', label: 'Request anything' },
        { to: '/tenant/requests', label: 'My requests', end: true },
        { to: '/tenant/food', label: 'Order food' },
        { to: '/tenant/orders', label: 'My orders' },
        { to: '/tenant/parking', label: 'Parking' },
        { to: '/tenant/visitors', label: 'Visitors' },
        { to: '/tenant/bookings', label: 'Book a space' },
        { to: '/tenant/sos', label: 'SOS' },
      ];
      if (profile.role_code === 'T1') n.push({ to: '/tenant/billing', label: 'Charges' });
      return n;
    }
    case 'staff': {
      const n = [HOME('staff'), { to: '/staff/queue', label: 'Work queue' }];
      if (['fnb', 'coffee'].includes(profile.team)) n.push({ to: '/staff/orders', label: 'Order queue' });
      if (profile.team === 'parking') n.push({ to: '/staff/parking', label: 'Parking desk' });
      if (['reception', 'security'].includes(profile.team)) n.push({ to: '/staff/reception', label: 'Reception' });
      if (['reception', 'security', 'parking', 'cctv'].includes(profile.team)) n.push({ to: '/staff/gate', label: 'Gate scanner' });
      if (profile.team === 'events') n.push({ to: '/staff/events', label: 'Event approvals' });
      if (profile.team === 'parcel') n.push({ to: '/staff/parcels', label: 'Parcel desk' });
      if (['bms', 'network', 'energy', 'security', 'fm'].includes(profile.team)) n.push({ to: '/staff/devices', label: 'Devices' });
      if (['stores', 'fnb', 'coffee', 'housekeeping', 'laundry', 'medical'].includes(profile.team)) n.push({ to: '/staff/stock', label: 'Stock' });
      return n;
    }
    case 'outlet':
      return [HOME('outlet'), { to: '/outlet/orders', label: 'Orders' }, { to: '/outlet/menu', label: 'Menu' }, { to: '/outlet/stock', label: 'Stock' }];
    case 'vendor':
      return [HOME('vendor'), { to: '/vendor/work', label: 'Work orders' }];
    case 'admin':
      return [
        { to: '/admin', label: 'Dashboard', end: true },
        { to: '/admin/portals', label: 'User Portals' },
        { to: '/admin/requests', label: 'All requests' },
        { to: '/admin/orders', label: 'Orders' },
        { to: '/admin/devices', label: 'Devices' },
        { to: '/admin/building', label: 'Building' },
        { to: '/admin/analytics', label: 'Analytics' },
        { to: '/admin/billing', label: 'Billing' },
        { to: '/admin/more', label: 'More' },
      ];
    default:
      return [];
  }
}

export const COMING = {
  tenant: 'Everything in this demo is live.',
  staff: 'Everything in this demo is live. Device alarms arrive as requests in your queue.',
  outlet: 'Everything in this demo is live.',
  vendor: 'Everything in this demo is live. Your permit QR opens the public pass page.',
  admin: 'Everything in this demo is live. Use Devices to fire events and Building to watch floors react.',
};