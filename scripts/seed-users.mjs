// Creates ~60 demo logins + a bit of starter activity. Run once:  npm run seed-users
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ROLES, emailFor } from '../src/config/roles.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.seed' });
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';
if (!URL || URL.includes('your-') || !SERVICE || SERVICE.includes('your-')) {
  console.error('Fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.seed first.'); process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function existingUsers() {
  const map = new Map(); let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    data.users.forEach((u) => map.set(u.email, u.id));
    if (data.users.length < 200) break; page++;
  }
  return map;
}

const have = await existingUsers();
let made = 0, kept = 0;
for (const r of ROLES) {
  const email = emailFor(r.code);
  let id = have.get(email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: r.full_name } });
    if (error) { console.error('FAILED', email, error.message); continue; }
    id = data.user.id; made++;
  } else {
    await admin.auth.admin.updateUserById(id, { password: PASSWORD }); kept++;
  }
  const { error: pe } = await admin.from('profiles').upsert({
    id, email, full_name: r.full_name, role_code: r.code, portal: r.portal, team: r.team ?? null,
    tenant_id: r.tenant_id ?? null, outlet_id: r.outlet_id ?? null, vendor_id: r.vendor_id ?? null, active: true,
  });
  if (pe) console.error('PROFILE FAILED', r.code, pe.message);
}
console.log(`Users: ${made} created, ${kept} already existed. Password for all: ${PASSWORD}`);

// ---- starter activity so dashboards are not empty (only if no tickets yet) ----
const { count } = await admin.from('tickets').select('*', { count: 'exact', head: true });
if (!count && ANON) {
  const as = async (code) => {
    const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.auth.signInWithPassword({ email: emailFor(code), password: PASSWORD });
    if (error) throw new Error(code + ': ' + error.message);
    return c;
  };
  const run = async (label, fn) => { try { await fn(); console.log('  ✓', label); } catch (e) { console.log('  ✗', label, '-', e.message); } };
  console.log('Seeding starter activity…');
  const t2 = await as('T2'), t5 = await as('T5'), t3 = await as('T3');
  await run('T2 hvac ticket', () => t2.rpc('raise_ticket', { p_category: 'hvac', p_title: 'AC too warm near window desks', p_description: 'Zone B feels 28°C', p_location: 'Unit 401' }).then(ck));
  await run('T2 wifi ticket', () => t2.rpc('raise_ticket', { p_category: 'it_wifi', p_title: 'Weak Wi-Fi in 401', p_description: 'Drops every few minutes', p_location: 'Unit 401' }).then(ck));
  await run('T5 housekeeping', () => t5.rpc('raise_ticket', { p_category: 'housekeeping', p_title: 'Room turnover needed', p_location: '8th floor' }).then(ck));
  await run('T3 waste pickup', () => t3.rpc('raise_ticket', { p_category: 'waste', p_title: 'Cardboard pickup', p_location: 'UG · R-UG-01' }).then(ck));
  await run('T2 coffee order', async () => {
    const { data: m } = await admin.from('menu_items').select('id').eq('outlet_id', 'out_caffeine').limit(2);
    await t2.rpc('place_order', { p_outlet: 'out_caffeine', p_items: m.map((x) => ({ item_id: x.id, qty: 1 })), p_location: 'Unit 401' }).then(ck);
  });
  await run('T2 invites visitor', () => t2.rpc('invite_visitor', { p_name: 'Rahul Verma', p_phone: '9876543210', p_purpose: 'Client meeting', p_floor: '4', p_parking: false }).then(ck));
}
function ck({ error }) { if (error) throw new Error(error.message); }
console.log('Done.');
