// Single source of truth for roles. Used by the app AND scripts/seed-users.mjs (so no browser-only imports here).
export const DEMO_DOMAIN = 'ascend-demo.com';

export const TEAMS = {
  reception: 'Reception & Visitors', security: 'Security & Access', cctv: 'CCTV / NVR', parking: 'Parking Control', valet: 'Valet',
  fnb: 'Restaurant & Bar Ops', coffee: 'Coffee Bar', events: 'Events & Spaces', housekeeping: 'Housekeeping', laundry: 'Laundry & Linen',
  concierge: 'Concierge & Business Centre', fm: 'FM Helpdesk', mep: 'MEP & Plant', landscape: 'Landscape & Water Features',
  waste: 'Waste & Recycling', stores: 'Stores & Inventory', pmo: 'PMO / Fit-out', medical: 'Medical Room', creche: 'Creche',
  it_av: 'IT / AV Support', network: 'Network & Cybersecurity', it_support: 'IT & Network Provisioning', bms: 'BMS Desk',
  energy: 'Energy / Water / Sustainability', transport: 'Transport & Shuttle', parcel: 'Parcel & Mailroom', ev: 'EV Charging',
  carwash: 'Car Wash Ops', wellness: 'Wellness Ops', pest: 'Pest Control', signage: 'Signage & Content', cs: 'Customer Service',
};

const T = (code, label, name, tenant_id, blurb) => ({ code, portal: 'tenant', label, full_name: name, tenant_id, blurb });
const S = (n, team, name) => ({ code: 'S' + String(n).padStart(2, '0'), portal: 'staff', team, label: TEAMS[team], full_name: name });
const O = (code, label, name, outlet_id) => ({ code, portal: 'outlet', label, full_name: name, outlet_id });
const M = (code, label, name, blurb) => ({ code, portal: 'admin', label, full_name: name, blurb });
const X = (code, label, name, vendor_id) => ({ code, portal: 'vendor', label, full_name: name, vendor_id });

export const ROLES = [
  T('T1', 'Office tenant administrator', 'Arjun Mehta', 'tn_northwind', 'Manages company users, quota, approvals'),
  T('T2', 'Office employee', 'Priya Nair', 'tn_northwind', 'Food, parking, visitors, rooms, requests'),
  T('T3', 'Retail tenant administrator', 'Kavya Reddy', 'tn_brightcart', 'Retail unit, deliveries, waste, signage'),
  T('T4', 'Retail employee', 'Imran Sheikh', 'tn_brightcart', 'Staff access, deliveries, maintenance'),
  T('T5', 'Hospitality guest / occupant', 'Sofia Daniels', 'tn_stayhub', 'Housekeeping, concierge, room service'),
  T('T6', 'Event organizer', 'Rohit Varma', 'tn_summit', 'Event space bookings, guest passes'),
  T('T7', 'Parent / guardian', 'Anita Joshi', 'tn_northwind', 'Creche booking and pickup list'),
  T('T8', 'Advertiser', 'Dev Malhotra', 'tn_adverto', 'Ad slots and creatives'),
  T('T9', 'Leasing prospect', 'Neha Kapoor', null, 'Enquiry and site visit'),

  S(1, 'reception', 'Rekha Menon'), S(2, 'security', 'Vikram Singh'), S(3, 'cctv', 'Farhan Ali'), S(4, 'parking', 'Suresh Babu'),
  S(5, 'valet', 'Kiran Kumar'), S(6, 'fnb', 'Chef Anwar'), S(7, 'coffee', 'Lakshmi Rao'), S(8, 'events', 'Tanvi Shah'),
  S(9, 'housekeeping', 'Sunita Devi'), S(10, 'laundry', 'Mohan Das'), S(11, 'concierge', 'Aarav Bose'), S(12, 'fm', 'Ramesh Naidu'),
  S(13, 'mep', 'Srinivas Goud'), S(14, 'landscape', 'Gopal Yadav'), S(15, 'waste', 'Bhaskar Rao'), S(16, 'stores', 'Padma Latha'),
  S(17, 'pmo', 'Harish Chandra'), S(18, 'medical', 'Nurse Joseph'), S(19, 'creche', 'Meena Kumari'), S(20, 'it_av', 'Nikhil Verma'),
  S(21, 'network', 'Sanjay Pillai'), S(22, 'it_support', 'Divya Menon'), S(23, 'bms', 'Prakash Reddy'), S(24, 'energy', 'Swathi Iyer'),
  S(25, 'transport', 'Yusuf Khan'), S(26, 'parcel', 'Lalitha Devi'), S(27, 'ev', 'Arvind Kumar'), S(28, 'carwash', 'Raju Mohan'),
  S(29, 'wellness', 'Zoya Fernandes'), S(30, 'pest', 'Venkat Rao'), S(31, 'signage', 'Isha Gupta'), S(32, 'cs', 'Pooja Sharma'),

  O('O1', 'Restaurant / bar', 'Chef Rahul Khanna', 'out_deck'), O('O2', 'Café / coffee bar', 'Barista Maya', 'out_caffeine'),
  O('O3', 'Retail outlet', 'Shop Lead Nisha', 'out_brightcart'), O('O4', 'Laundry provider', 'Ravi Laundry', 'out_laundry'),
  O('O5', 'Car-wash provider', 'Shine Lead Babu', 'out_carwash'), O('O6', 'Wellness operator', 'Coach Anil', 'out_wellness'),
  O('O7', 'Other on-site outlet', 'Pharmacist Geeta', 'out_pharmacy'),

  M('M1', 'Super administrator', 'Meera Iyer', 'Accounts, roles, portals, global config'),
  M('M2', 'Building operations admin', 'Rajesh Kulkarni', 'Service routing, SLAs, incidents'),
  M('M3', 'Property & lease admin', 'Sana Qureshi', 'Tenants, units, leases, quotas'),
  M('M4', 'Finance admin', 'Dinesh Patel', 'Invoices, charges, reconciliation'),
  M('M5', 'Security & safety admin', 'Col. Ajay Rao', 'Access policy, incidents, emergencies'),
  M('M6', 'Compliance & analytics', 'Ishita Bansal', 'Certificates, sustainability, reports'),

  X('X1', 'MEP / maintenance contractor', 'Technician Ravi (CoolAire)', 'vn_mep'),
  X('X2', 'Lift contractor', 'Technician Anil (Skyline)', 'vn_lift'),
  X('X3', 'IT / ISP / network provider', 'Engineer Neel (NetCore)', 'vn_isp'),
  X('X4', 'Cleaning / pest / waste contractor', 'Supervisor Latif (PureServe)', 'vn_clean'),
  X('X5', 'Food / amenity supplier', 'Driver Manoj (FreshCrate)', 'vn_supply'),
  X('X6', 'EV / power specialist', 'Engineer Tara (VoltGrid)', 'vn_ev'),
  X('X8', 'Other specialist vendor', 'Specialist Omar (Apex)', 'vn_spec'),
];

// Pass-only experiences (no login) — shown in Admin → User Portals as "open sample pass"
export const PASS_VIEWS = [
  { code: 'V1', label: 'Pre-registered visitor' }, { code: 'V2', label: 'Walk-in visitor' }, { code: 'V3', label: 'Event guest' },
  { code: 'V4', label: 'Food-delivery rider' }, { code: 'V5', label: 'Courier / parcel carrier' }, { code: 'V6', label: 'Creche pickup contact' },
];

export const PORTALS = [
  { id: 'tenant', label: 'Tenant portal', blurb: 'Office, retail, hospitality, events, guardians, advertisers, prospects', color: '#2563eb' },
  { id: 'staff', label: 'Staff console', blurb: '32 operational desks sharing one queue engine', color: '#0ea5e9' },
  { id: 'outlet', label: 'Outlet portal', blurb: 'Restaurant, café, retail and service-provider staff', color: '#1d4ed8' },
  { id: 'vendor', label: 'Vendor portal', blurb: 'Contractors see only assigned work orders and permits', color: '#3b82f6' },
  { id: 'admin', label: 'Management console', blurb: 'Configuration, approvals, billing, analytics, audit', color: '#1e3a8a' },
];

export const emailFor = (code) => `${code.toLowerCase()}@${DEMO_DOMAIN}`;
export const roleByCode = (code) => ROLES.find((r) => r.code === code);
