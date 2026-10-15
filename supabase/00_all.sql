-- ============================================================
-- ASCEND DEMO  |  PART 1: SCHEMA
-- Paste ALL parts (p1..p5) into Supabase SQL Editor, or just run the combined 00_all.sql
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- reference data ----------
create table if not exists tenants (
  id text primary key, name text not null, kind text not null default 'office',
  floor text, units text, parking_quota int not null default 4, active boolean default true
);
create table if not exists outlets (
  id text primary key, name text not null, kind text not null, team text, location text, tenant_id text
);
create table if not exists vendors (
  id text primary key, name text not null, category text not null
);
create table if not exists locations (
  id text primary key, level text not null, name text not null, kind text not null default 'zone'
);

-- ---------- identity ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text not null,
  role_code text not null,                 -- T1..T9, S01.., O1.., M1.., X1..
  portal text not null check (portal in ('tenant','staff','outlet','admin','vendor')),
  team text, tenant_id text references tenants(id), outlet_id text references outlets(id),
  vendor_id text references vendors(id), active boolean not null default true,
  created_at timestamptz default now()
);

-- ---------- ticket engine ----------
create sequence if not exists ticket_seq start 1001;
create table if not exists category_routes (
  category text primary key, label text not null, team text not null,
  also_team text, sla_minutes int not null default 240, priority text not null default 'normal',
  tenant_facing boolean not null default true, icon text
);
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default ('TKT-' || nextval('ticket_seq')),
  category text not null references category_routes(category),
  team text not null, title text not null, description text,
  status text not null default 'routed' check (status in
    ('raised','routed','accepted','in_progress','fulfilled','closed','rejected','cancelled','expired','on_hold','escalated')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  source text not null default 'user',     -- user | device | system
  requester_id uuid references profiles(id), tenant_id text references tenants(id),
  outlet_id text references outlets(id), vendor_id text references vendors(id),
  assignee_id uuid references profiles(id), parent_id uuid references tickets(id),
  location text, linked_type text, linked_id uuid, device_id uuid,
  meta jsonb not null default '{}'::jsonb,
  sla_due timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists tickets_team_idx on tickets(team, status);
create index if not exists tickets_req_idx on tickets(requester_id);
create index if not exists tickets_outlet_idx on tickets(outlet_id);

create table if not exists ticket_events (
  id bigserial primary key, ticket_id uuid not null references tickets(id) on delete cascade,
  actor_id uuid, actor_name text, from_status text, to_status text, note text, created_at timestamptz default now()
);
create table if not exists notifications (
  id bigserial primary key, user_id uuid not null references profiles(id) on delete cascade,
  title text not null, body text, ticket_id uuid, level text default 'info', read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notif_user_idx on notifications(user_id, read);
create table if not exists audit_log (
  id bigserial primary key, actor_id uuid, actor_name text, action text not null,
  entity text, entity_id text, details jsonb, created_at timestamptz default now()
);
create table if not exists feedback (
  id bigserial primary key, ticket_id uuid unique references tickets(id) on delete cascade,
  user_id uuid references profiles(id), rating int check (rating between 1 and 5), comment text,
  created_at timestamptz default now()
);

-- ---------- food ----------
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(), outlet_id text not null references outlets(id),
  name text not null, description text, price numeric(10,2) not null, section text default 'Mains', available boolean default true
);
create table if not exists orders (
  id uuid primary key default gen_random_uuid(), ticket_id uuid references tickets(id) on delete cascade,
  requester_id uuid references profiles(id), tenant_id text references tenants(id), outlet_id text references outlets(id),
  items jsonb not null, total numeric(10,2) not null, delivery_location text,
  status text not null default 'placed' check (status in ('placed','accepted','preparing','ready','out_for_delivery','delivered','cancelled','rejected')),
  eta_minutes int, created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- passes & scans ----------
create table if not exists passes (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(9),'hex'),
  kind text not null check (kind in ('visitor','parking','food_delivery','vendor','event','parcel')),
  holder_name text, host_id uuid references profiles(id), tenant_id text references tenants(id),
  ticket_id uuid references tickets(id) on delete cascade,
  valid_from timestamptz not null default now(), valid_to timestamptz not null,
  max_uses int not null default 1, uses int not null default 0,
  status text not null default 'active' check (status in ('active','used','expired','revoked')),
  zone text, meta jsonb not null default '{}'::jsonb, created_at timestamptz default now()
);
create table if not exists pass_scans (
  id bigserial primary key, pass_id uuid references passes(id) on delete cascade, token text,
  gate text, result text not null, message text, scanned_by uuid, created_at timestamptz default now()
);

-- ---------- parking ----------
create table if not exists parking_bays (
  id uuid primary key default gen_random_uuid(), code text unique not null, level text not null,
  vtype text not null check (vtype in ('car','bike')),
  zone text not null default 'tenant' check (zone in ('tenant','visitor','ev','accessible','delivery','staff','valet')),
  status text not null default 'free' check (status in ('free','reserved','occupied','blocked'))
);
create table if not exists parking_requests (
  id uuid primary key default gen_random_uuid(), ticket_id uuid references tickets(id) on delete cascade,
  requester_id uuid references profiles(id), tenant_id text references tenants(id),
  vehicle_no text not null, vtype text not null default 'car', is_visitor boolean default false,
  bay_id uuid references parking_bays(id), pass_id uuid references passes(id),
  status text not null default 'requested' check (status in ('requested','allocated','parked','exited','expired','rejected')),
  entered_at timestamptz, exited_at timestamptz, created_at timestamptz default now()
);

-- ---------- visitors ----------
create table if not exists visitors (
  id uuid primary key default gen_random_uuid(), name text not null, phone text, purpose text,
  host_id uuid references profiles(id), tenant_id text references tenants(id), floor text,
  kind text not null default 'pre_registered' check (kind in ('pre_registered','walk_in')),
  status text not null default 'invited' check (status in ('invited','pending_approval','approved','arrived','departed','denied','expired')),
  pass_id uuid references passes(id), ticket_id uuid references tickets(id) on delete set null,
  expected_from timestamptz, expected_to timestamptz, arrived_at timestamptz, departed_at timestamptz,
  created_by uuid, created_at timestamptz default now()
);

-- ---------- bookings ----------
create table if not exists resources (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null,
  kind text not null check (kind in ('room','desk','locker','ev_charger','event_space','carwash_slot')),
  level text, capacity int default 1, needs_approval boolean default false
);
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references resources(id),
  user_id uuid not null references profiles(id), tenant_id text references tenants(id),
  title text, starts_at timestamptz not null, ends_at timestamptz not null, attendees int default 1,
  status text not null default 'confirmed' check (status in ('pending','confirmed','rejected','cancelled','completed')),
  ticket_id uuid references tickets(id) on delete set null, created_at timestamptz default now(),
  check (ends_at > starts_at)
);
create index if not exists bookings_res_idx on bookings(resource_id, starts_at);

-- ---------- devices, stock, billing ----------
create table if not exists devices (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null,
  kind text not null, location text, status text not null default 'online',
  last_event_at timestamptz
);
create table if not exists device_events (
  id bigserial primary key, device_id uuid references devices(id) on delete cascade,
  event_type text not null, severity text default 'info', payload jsonb default '{}'::jsonb,
  ticket_ids uuid[] default '{}', created_at timestamptz default now()
);
create table if not exists device_rules (
  event_type text not null, category text not null references category_routes(category),
  priority text not null default 'normal', title text not null, notify_all_staff boolean default false,
  primary key (event_type, category)
);
create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null,
  category text not null, qty numeric not null, reorder_level numeric not null, unit text default 'pcs',
  location text, low_alerted boolean default false
);
create table if not exists charges (
  id uuid primary key default gen_random_uuid(), tenant_id text references tenants(id),
  user_id uuid references profiles(id), source_type text not null, source_id uuid,
  description text not null, amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','billed','void')),
  created_at timestamptz default now()
);
-- ============================================================
-- PART 2: HELPERS + TICKET ENGINE + FOOD
-- ============================================================
create or replace function public.me() returns profiles
language sql stable security definer set search_path = public as
$$ select * from profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select portal = 'admin' and active from profiles where id = auth.uid()), false) $$;

create or replace function public._actor_name() returns text
language sql stable security definer set search_path = public as
$$ select coalesce((select full_name from profiles where id = auth.uid()), 'System') $$;

create or replace function public._audit(p_action text, p_entity text, p_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as
$$ insert into audit_log(actor_id, actor_name, action, entity, entity_id, details)
   values (auth.uid(), _actor_name(), p_action, p_entity, p_id, p_details) $$;

create or replace function public._notify(p_user uuid, p_title text, p_body text, p_ticket uuid default null, p_level text default 'info')
returns void language sql security definer set search_path = public as
$$ insert into notifications(user_id, title, body, ticket_id, level) values (p_user, p_title, p_body, p_ticket, p_level) $$;

create or replace function public._notify_team(p_team text, p_outlet text, p_title text, p_body text, p_ticket uuid, p_level text, p_skip uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, title, body, ticket_id, level)
  select id, p_title, p_body, p_ticket, p_level from profiles
  where active and id is distinct from p_skip
    and ((portal = 'staff' and team = p_team) or (portal = 'outlet' and p_outlet is not null and outlet_id = p_outlet));
end $$;

-- ---------- internal: create a ticket (+ optional sibling for also_team) ----------
create or replace function public._create_ticket(
  p_category text, p_title text, p_desc text, p_location text, p_priority text,
  p_requester uuid, p_tenant text, p_outlet text, p_source text default 'user',
  p_meta jsonb default '{}', p_parent uuid default null, p_device uuid default null, p_team text default null)
returns tickets language plpgsql security definer set search_path = public as $$
declare r category_routes; t tickets; t2 tickets; pr text;
begin
  select * into r from category_routes where category = p_category;
  if r.category is null then raise exception 'Unknown category %', p_category; end if;
  pr := coalesce(p_priority, r.priority);
  insert into tickets(category, team, title, description, priority, source, requester_id, tenant_id, outlet_id,
                      location, meta, parent_id, device_id, sla_due, status)
  values (p_category, coalesce(p_team, r.team), p_title, p_desc, pr, p_source, p_requester, p_tenant, p_outlet,
          p_location, coalesce(p_meta,'{}'), p_parent, p_device, now() + make_interval(mins => r.sla_minutes), 'routed')
  returning * into t;
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note)
  values (t.id, auth.uid(), case when p_source = 'user' then _actor_name() else initcap(p_source) end, 'raised', 'routed',
          'Raised and routed to ' || t.team);
  perform _notify_team(t.team, p_outlet, case when pr in ('high','critical') then '🚨 ' else '' end || 'New: ' || p_title,
                       coalesce(p_location,''), t.id, case when pr = 'critical' then 'critical' else 'info' end, p_requester);
  if r.also_team is not null and p_parent is null then
    select * into t2 from _create_ticket(p_category, p_title || ' (copy)', p_desc, p_location, pr, p_requester, p_tenant,
                                          null, p_source, p_meta, t.id, p_device, r.also_team);
  end if;
  return t;
end $$;

-- ---------- tenant/any-user: raise a ticket ----------
create or replace function public.raise_ticket(
  p_category text, p_title text, p_description text default null, p_location text default null,
  p_priority text default null, p_meta jsonb default '{}')
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets;
begin
  p := me(); if p.id is null or not p.active then raise exception 'Not signed in'; end if;
  t := _create_ticket(p_category, p_title, p_description, p_location, p_priority, p.id, p.tenant_id, null, 'user', p_meta);
  perform _audit('ticket.raise', 'ticket', t.ref, jsonb_build_object('category', p_category));
  return t;
end $$;

-- ---------- internal: apply a status change with all side effects ----------
create or replace function public._apply_status(p_ticket uuid, p_status text, p_note text default null)
returns tickets language plpgsql security definer set search_path = public as $$
declare t tickets; old text; terminal boolean; pr parking_requests;
begin
  select * into t from tickets where id = p_ticket for update;
  if t.id is null then raise exception 'Ticket not found'; end if;
  old := t.status;
  if old = p_status then return t; end if;
  update tickets set status = p_status, updated_at = now() where id = p_ticket returning * into t;
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note)
  values (t.id, auth.uid(), _actor_name(), old, p_status, p_note);
  if t.requester_id is not null and t.requester_id is distinct from auth.uid() then
    perform _notify(t.requester_id, t.ref || ' → ' || replace(p_status, '_', ' '), coalesce(p_note, t.title), t.id,
                    case when p_status in ('rejected','cancelled','expired') then 'warn' else 'info' end);
  end if;
  terminal := p_status in ('fulfilled','closed','cancelled','rejected','expired');
  if terminal then
    update passes set status = 'revoked' where ticket_id = t.id and status = 'active';
    -- parking: release bay
    for pr in select * from parking_requests where ticket_id = t.id and status in ('requested','allocated','parked') loop
      if pr.bay_id is not null then update parking_bays set status = 'free' where id = pr.bay_id; end if;
      update parking_requests set status = case when p_status in ('fulfilled','closed') then 'exited'
                                               when p_status = 'expired' then 'expired' else 'rejected' end,
             exited_at = case when pr.status = 'parked' then now() else exited_at end where id = pr.id;
    end loop;
    -- food: sync order + billing
    update orders set status = case when p_status in ('fulfilled','closed') then 'delivered'
                                    when p_status = 'rejected' then 'rejected' else 'cancelled' end, updated_at = now()
      where ticket_id = t.id and status not in ('delivered','cancelled','rejected');
    update charges set status = case when p_status in ('fulfilled','closed') then 'billed' else 'void' end
      where source_type = 'order' and source_id = t.linked_id and status = 'pending' and t.linked_type = 'order';
    -- visitors
    update visitors set status = case when p_status in ('fulfilled','closed') then 'departed'
                                      when p_status = 'rejected' then 'denied' else 'expired' end,
           departed_at = case when p_status in ('fulfilled','closed') then now() else departed_at end
      where ticket_id = t.id and status in ('invited','pending_approval','approved','arrived');
    -- bookings
    update bookings set status = 'cancelled' where ticket_id = t.id and p_status in ('cancelled','rejected','expired') and status in ('pending','confirmed');
  end if;
  perform _audit('ticket.status', 'ticket', t.ref, jsonb_build_object('from', old, 'to', p_status));
  return t;
end $$;

-- ---------- permission check ----------
create or replace function public._can_act(p profiles, t tickets) returns boolean
language sql immutable as $$
  select p.active and (
    p.portal = 'admin'
    or (p.portal = 'staff' and p.team = t.team)
    or (p.portal = 'outlet' and p.outlet_id is not null and p.outlet_id = t.outlet_id)
    or t.assignee_id = p.id
  ) $$;

create or replace function public.set_ticket_status(p_ticket uuid, p_status text, p_note text default null)
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets; o orders;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if t.id is null then raise exception 'Ticket not found'; end if;
  if _can_act(p, t) then
    null;
  elsif p.portal = 'vendor' and p.vendor_id = t.vendor_id and p_status in ('accepted','in_progress','fulfilled','on_hold') then
    null;
  elsif t.requester_id = p.id and ((p_status = 'cancelled' and t.status in ('raised','routed','accepted','on_hold'))
                                   or (p_status = 'closed' and t.status = 'fulfilled')) then
    null;
  else
    raise exception 'You are not allowed to change this ticket';
  end if;
  if t.linked_type = 'order' and p_status in ('accepted','in_progress','fulfilled') and t.requester_id is distinct from p.id then
    select * into o from orders where id = t.linked_id;
    perform _advance_order(o.id, case p_status when 'accepted' then 'accepted' when 'in_progress' then 'preparing' else 'delivered' end, null);
    select * into t from tickets where id = p_ticket; return t;
  end if;
  return _apply_status(p_ticket, p_status, p_note);
end $$;

create or replace function public.add_ticket_note(p_ticket uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if t.id is null then raise exception 'Ticket not found'; end if;
  if not (_can_act(p, t) or t.requester_id = p.id or (p.portal = 'vendor' and p.vendor_id = t.vendor_id)) then raise exception 'Not allowed'; end if;
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note) values (t.id, p.id, p.full_name, t.status, t.status, p_note);
  if t.requester_id is not null and t.requester_id <> p.id then perform _notify(t.requester_id, t.ref || ' update', p_note, t.id); end if;
end $$;

create or replace function public.assign_ticket(p_ticket uuid, p_assignee uuid default null)
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets; a uuid;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  a := coalesce(p_assignee, p.id);
  update tickets set assignee_id = a, updated_at = now(), status = case when status in ('raised','routed') then 'accepted' else status end where id = t.id returning * into t;
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note)
  values (t.id, p.id, p.full_name, t.status, t.status, 'Assigned to ' || (select full_name from profiles where id = a));
  if a <> p.id then perform _notify(a, 'Assigned: ' || t.ref, t.title, t.id); end if;
  if t.requester_id is not null then perform _notify(t.requester_id, t.ref || ' accepted', 'Assigned to ' || (select full_name from profiles where id = a), t.id); end if;
  return t;
end $$;

create or replace function public.route_ticket(p_ticket uuid, p_team text)
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  update tickets set team = p_team, assignee_id = null, updated_at = now(), status = 'routed' where id = t.id returning * into t;
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note) values (t.id, p.id, p.full_name, 'routed', 'routed', 'Re-routed to ' || p_team);
  perform _notify_team(p_team, null, 'Routed to you: ' || t.title, coalesce(t.location, ''), t.id, 'info', p.id);
  return t;
end $$;

create or replace function public.assign_vendor(p_ticket uuid, p_vendor text, p_hours int default 8)
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets; v vendors;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  select * into v from vendors where id = p_vendor; if v.id is null then raise exception 'Unknown vendor'; end if;
  update tickets set vendor_id = v.id, updated_at = now() where id = t.id returning * into t;
  insert into passes(kind, holder_name, ticket_id, valid_to, max_uses, zone, meta)
  values ('vendor', v.name || ' technician', t.id, now() + make_interval(hours => p_hours), 4, coalesce(t.location, 'Service entrance'),
          jsonb_build_object('work_order', t.ref, 'permit', 'PTW-' || t.ref));
  insert into ticket_events(ticket_id, actor_id, actor_name, from_status, to_status, note)
  values (t.id, p.id, p.full_name, t.status, t.status, 'Work order sent to vendor ' || v.name || ' (permit + pass issued)');
  insert into notifications(user_id, title, body, ticket_id)
  select id, 'Work order: ' || t.ref, t.title, t.id from profiles where portal = 'vendor' and vendor_id = v.id and active;
  perform _audit('ticket.vendor', 'ticket', t.ref, jsonb_build_object('vendor', v.id));
  return t;
end $$;

create or replace function public.submit_feedback(p_ticket uuid, p_rating int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if t.requester_id is distinct from p.id then raise exception 'Only the requester can rate this'; end if;
  if t.status not in ('fulfilled','closed') then raise exception 'Rate after the service is complete'; end if;
  insert into feedback(ticket_id, user_id, rating, comment) values (t.id, p.id, p_rating, p_comment)
  on conflict (ticket_id) do update set rating = excluded.rating, comment = excluded.comment;
  if p_rating <= 2 then
    perform _create_ticket('complaint', 'Low rating (' || p_rating || '★) on ' || t.ref, coalesce(p_comment, t.title), t.location, 'high',
                           p.id, p.tenant_id, null, 'system', '{}', t.id);
  end if;
  if t.status = 'fulfilled' then perform _apply_status(t.id, 'closed', 'Closed after feedback'); end if;
end $$;

create or replace function public.mark_all_read() returns void language sql security definer set search_path = public as
$$ update notifications set read = true where user_id = auth.uid() and not read $$;

-- ================= FOOD ORDERS =================
create or replace function public._order_next_ok(o text, n text) returns boolean language sql immutable as $$
  select (o, n) in (('placed','accepted'),('placed','rejected'),('placed','cancelled'),('accepted','preparing'),('accepted','cancelled'),
                    ('preparing','ready'),('preparing','cancelled'),('ready','out_for_delivery'),('ready','delivered'),('out_for_delivery','delivered')) $$;

create or replace function public._advance_order(p_order uuid, p_status text, p_eta int)
returns orders language plpgsql security definer set search_path = public as $$
declare o orders; t tickets; ts text;
begin
  select * into o from orders where id = p_order for update;
  if not _order_next_ok(o.status, p_status) then raise exception 'Cannot move order from % to %', o.status, p_status; end if;
  update orders set status = p_status, eta_minutes = coalesce(p_eta, eta_minutes), updated_at = now() where id = o.id returning * into o;
  ts := case p_status when 'accepted' then 'accepted' when 'preparing' then 'in_progress' when 'ready' then 'in_progress'
                      when 'out_for_delivery' then 'in_progress' when 'delivered' then 'fulfilled'
                      when 'rejected' then 'rejected' when 'cancelled' then 'cancelled' else 'routed' end;
  if p_status = 'ready' and not exists (select 1 from passes where ticket_id = o.ticket_id and kind = 'food_delivery' and status = 'active') then
    insert into passes(kind, holder_name, ticket_id, tenant_id, valid_to, max_uses, zone, meta)
    values ('food_delivery', 'Delivery runner', o.ticket_id, o.tenant_id, now() + interval '45 minutes', 2, 'LG handover point',
            jsonb_build_object('order', o.id, 'deliver_to', o.delivery_location));
  end if;
  perform _apply_status(o.ticket_id, ts, 'Order ' || replace(p_status, '_', ' ') || case when p_eta is not null then ' · ETA ' || p_eta || ' min' else '' end);
  update orders set status = p_status where id = o.id returning * into o;   -- _apply_status may normalise; keep fine-grained status
  return o;
end $$;

create or replace function public.advance_order(p_order uuid, p_status text, p_eta int default null)
returns orders language plpgsql security definer set search_path = public as $$
declare p profiles; o orders; t tickets;
begin
  p := me(); select * into o from orders where id = p_order; select * into t from tickets where id = o.ticket_id;
  if o.id is null then raise exception 'Order not found'; end if;
  if _can_act(p, t) then null;
  elsif o.requester_id = p.id and ((p_status = 'cancelled' and o.status in ('placed','accepted'))
                                   or (p_status = 'delivered' and o.status in ('ready','out_for_delivery'))) then null;
  else raise exception 'Not allowed'; end if;
  return _advance_order(p_order, p_status, p_eta);
end $$;

create or replace function public.place_order(p_outlet text, p_items jsonb, p_location text default null, p_notes text default null)
returns orders language plpgsql security definer set search_path = public as $$
declare p profiles; ou outlets; o orders; t tickets; line jsonb; m menu_items; lines jsonb := '[]'; tot numeric := 0; q int; cat text;
begin
  p := me(); if p.id is null then raise exception 'Not signed in'; end if;
  select * into ou from outlets where id = p_outlet; if ou.id is null then raise exception 'Unknown outlet'; end if;
  for line in select * from jsonb_array_elements(p_items) loop
    q := greatest(coalesce((line->>'qty')::int, 1), 1);
    select * into m from menu_items where id = (line->>'item_id')::uuid and outlet_id = p_outlet and available;
    if m.id is null then raise exception 'An item is unavailable'; end if;
    tot := tot + m.price * q;
    lines := lines || jsonb_build_array(jsonb_build_object('item_id', m.id, 'name', m.name, 'price', m.price, 'qty', q));
  end loop;
  if jsonb_array_length(lines) = 0 then raise exception 'Cart is empty'; end if;
  cat := case when ou.kind = 'cafe' then 'coffee' else 'food' end;
  t := _create_ticket(cat, 'Order from ' || ou.name, p_notes, p_location, null, p.id, p.tenant_id, ou.id, 'user', '{}');
  insert into orders(ticket_id, requester_id, tenant_id, outlet_id, items, total, delivery_location)
  values (t.id, p.id, p.tenant_id, ou.id, lines, tot, p_location) returning * into o;
  update tickets set linked_type = 'order', linked_id = o.id where id = t.id;
  insert into charges(tenant_id, user_id, source_type, source_id, description, amount)
  values (p.tenant_id, p.id, 'order', o.id, 'Food order · ' || ou.name, tot);
  perform _audit('order.place', 'order', o.id::text, jsonb_build_object('total', tot));
  return o;
end $$;
-- ============================================================
-- PART 3: PARKING, VISITORS, PASS SCAN, BOOKINGS, PARCELS, DEVICES, STOCK
-- ============================================================

-- ================= PARKING =================
create or replace function public._request_parking(p_requester uuid, p_tenant text, p_vehicle text, p_vtype text, p_visitor boolean, p_for text)
returns parking_requests language plpgsql security definer set search_path = public as $$
declare t tickets; pr parking_requests; used int; quota int;
begin
  if not p_visitor then
    select parking_quota into quota from tenants where id = p_tenant;
    select count(*) into used from parking_requests where tenant_id = p_tenant and not is_visitor and status in ('requested','allocated','parked');
    if quota is not null and used >= quota then raise exception 'Parking quota reached (% of % bays in use). Ask your tenant admin.', used, quota; end if;
  end if;
  t := _create_ticket('parking', 'Parking: ' || upper(p_vehicle) || coalesce(' · ' || p_for, ''), p_vtype || case when p_visitor then ' · visitor bay' else '' end,
                      'Parking', null, p_requester, p_tenant, null, 'user', jsonb_build_object('vehicle', upper(p_vehicle)));
  insert into parking_requests(ticket_id, requester_id, tenant_id, vehicle_no, vtype, is_visitor)
  values (t.id, p_requester, p_tenant, upper(p_vehicle), p_vtype, p_visitor) returning * into pr;
  update tickets set linked_type = 'parking', linked_id = pr.id where id = t.id;
  return pr;
end $$;

create or replace function public.request_parking(p_vehicle text, p_vtype text default 'car')
returns parking_requests language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  p := me(); if p.id is null then raise exception 'Not signed in'; end if;
  return _request_parking(p.id, p.tenant_id, p_vehicle, p_vtype, false, null);
end $$;

create or replace function public.allocate_parking(p_request uuid, p_bay uuid default null)
returns parking_requests language plpgsql security definer set search_path = public as $$
declare p profiles; pr parking_requests; t tickets; b parking_bays; ps passes; nm text;
begin
  p := me(); select * into pr from parking_requests where id = p_request for update;
  select * into t from tickets where id = pr.ticket_id;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  if pr.status <> 'requested' then raise exception 'Request already %', pr.status; end if;
  if p_bay is not null then
    select * into b from parking_bays where id = p_bay and status = 'free' and vtype = pr.vtype for update;
  else
    select * into b from parking_bays where status = 'free' and vtype = pr.vtype
      and zone = case when pr.is_visitor then 'visitor' else 'tenant' end
      order by case level when 'LG' then 0 when 'B1' then 1 when 'B2' then 2 when 'B3' then 3 else 4 end, code
      limit 1 for update skip locked;
  end if;
  if b.id is null then raise exception 'No free bay available for this request'; end if;
  update parking_bays set status = 'reserved' where id = b.id;
  select coalesce((select full_name from profiles where id = pr.requester_id), 'Visitor') into nm;
  insert into passes(kind, holder_name, host_id, tenant_id, ticket_id, valid_to, max_uses, zone, meta)
  values ('parking', nm || ' · ' || pr.vehicle_no, pr.requester_id, pr.tenant_id, pr.ticket_id, now() + interval '15 minutes', 2,
          'Bay ' || b.code, jsonb_build_object('bay', b.code, 'level', b.level, 'vehicle', pr.vehicle_no))
  returning * into ps;
  update parking_requests set status = 'allocated', bay_id = b.id, pass_id = ps.id where id = pr.id returning * into pr;
  perform _apply_status(pr.ticket_id, 'accepted', 'Bay ' || b.code || ' (' || b.level || ') reserved · entry QR valid 15 min');
  perform _audit('parking.allocate', 'parking_request', pr.id::text, jsonb_build_object('bay', b.code));
  return pr;
end $$;

create or replace function public.reject_parking(p_request uuid, p_reason text default 'No bay available')
returns void language plpgsql security definer set search_path = public as $$
declare p profiles; pr parking_requests; t tickets;
begin
  p := me(); select * into pr from parking_requests where id = p_request; select * into t from tickets where id = pr.ticket_id;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  perform _apply_status(pr.ticket_id, 'rejected', p_reason);
end $$;

-- ================= VISITORS =================
create or replace function public.invite_visitor(
  p_name text, p_phone text, p_purpose text, p_from timestamptz default now(), p_to timestamptz default now() + interval '4 hours',
  p_floor text default null, p_parking boolean default false, p_vehicle text default null)
returns visitors language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets; ps passes; v visitors; pr parking_requests;
begin
  p := me(); if p.id is null or p.tenant_id is null then raise exception 'Only tenant users can invite visitors'; end if;
  t := _create_ticket('visitor', 'Visitor: ' || p_name || ' → ' || p.full_name, p_purpose, 'Reception', null, p.id, p.tenant_id, null, 'user', '{}');
  insert into passes(kind, holder_name, host_id, tenant_id, ticket_id, valid_from, valid_to, max_uses, zone)
  values ('visitor', p_name, p.id, p.tenant_id, t.id, p_from, p_to, 2, 'Lobby → ' || coalesce('Floor ' || p_floor, 'host floor'))
  returning * into ps;
  insert into visitors(name, phone, purpose, host_id, tenant_id, floor, kind, status, pass_id, ticket_id, expected_from, expected_to, created_by)
  values (p_name, p_phone, p_purpose, p.id, p.tenant_id, p_floor, 'pre_registered', 'approved', ps.id, t.id, p_from, p_to, p.id) returning * into v;
  update tickets set linked_type = 'visitor', linked_id = v.id where id = t.id;
  perform _apply_status(t.id, 'accepted', 'Pre-registered · QR pass issued to visitor');
  if p_parking then
    pr := _request_parking(p.id, p.tenant_id, coalesce(p_vehicle, 'TBD'), 'car', true, p_name);
  end if;
  return v;
end $$;

create or replace function public.register_walkin(p_name text, p_phone text, p_purpose text, p_host uuid)
returns visitors language plpgsql security definer set search_path = public as $$
declare p profiles; h profiles; t tickets; v visitors;
begin
  p := me(); select * into h from profiles where id = p_host;
  if not (p.portal = 'admin' or (p.portal = 'staff' and p.team in ('reception','security'))) then raise exception 'Only reception or security can register walk-ins'; end if;
  if h.id is null then raise exception 'Choose a host'; end if;
  t := _create_ticket('visitor', 'Walk-in: ' || p_name || ' → ' || h.full_name, p_purpose, 'Reception', null, h.id, h.tenant_id, null, 'user', '{}');
  insert into visitors(name, phone, purpose, host_id, tenant_id, kind, status, ticket_id, created_by)
  values (p_name, p_phone, p_purpose, h.id, h.tenant_id, 'walk_in', 'pending_approval', t.id, p.id) returning * into v;
  update tickets set linked_type = 'visitor', linked_id = v.id where id = t.id;
  perform _notify(h.id, '🚪 Walk-in visitor needs approval', p_name || ' is at reception · ' || coalesce(p_purpose, ''), t.id, 'warn');
  return v;
end $$;

create or replace function public.decide_walkin(p_visitor uuid, p_approve boolean)
returns visitors language plpgsql security definer set search_path = public as $$
declare p profiles; v visitors; ps passes;
begin
  p := me(); select * into v from visitors where id = p_visitor for update;
  if not (v.host_id = p.id or p.portal = 'admin') then raise exception 'Only the host can decide'; end if;
  if v.status <> 'pending_approval' then raise exception 'Already %', v.status; end if;
  if p_approve then
    insert into passes(kind, holder_name, host_id, tenant_id, ticket_id, valid_to, max_uses, zone)
    values ('visitor', v.name, v.host_id, v.tenant_id, v.ticket_id, now() + interval '4 hours', 2, 'Lobby → host floor') returning * into ps;
    update visitors set status = 'approved', pass_id = ps.id where id = v.id returning * into v;
    perform _apply_status(v.ticket_id, 'accepted', 'Host approved · limited pass issued');
    perform _notify_team('reception', null, 'Walk-in approved', v.name, v.ticket_id, 'info', p.id);
  else
    perform _apply_status(v.ticket_id, 'rejected', 'Host declined the visit');
    perform _notify_team('reception', null, 'Walk-in declined', v.name, v.ticket_id, 'warn', p.id);
    select * into v from visitors where id = p_visitor;
  end if;
  return v;
end $$;

-- ================= PASS PAGE (public) + GATE SCAN =================
create or replace function public.get_pass_public(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ps passes; hn text; st text;
begin
  select * into ps from passes where token = p_token;
  if ps.id is null then return jsonb_build_object('found', false); end if;
  st := ps.status;
  if st = 'active' and now() > ps.valid_to and not (ps.kind = 'parking' and ps.uses > 0) then st := 'expired'; end if;
  select full_name into hn from profiles where id = ps.host_id;
  return jsonb_build_object('found', true, 'kind', ps.kind, 'holder', ps.holder_name, 'zone', ps.zone, 'status', st,
    'valid_from', ps.valid_from, 'valid_to', ps.valid_to, 'uses', ps.uses, 'max_uses', ps.max_uses, 'host', hn,
    'token', ps.token, 'detail', jsonb_build_object('bay', ps.meta->>'bay', 'level', ps.meta->>'level', 'vehicle', ps.meta->>'vehicle',
                                                    'deliver_to', ps.meta->>'deliver_to', 'permit', ps.meta->>'permit', 'work_order', ps.meta->>'work_order'));
end $$;
grant execute on function public.get_pass_public(text) to anon, authenticated;

create or replace function public._log_scan(ps passes, p_token text, p_gate text, p_result text, p_msg text) returns void
language sql security definer set search_path = public as
$$ insert into pass_scans(pass_id, token, gate, result, message, scanned_by) values (ps.id, p_token, p_gate, p_result, p_msg, auth.uid()) $$;

create or replace function public.scan_pass(p_token text, p_gate text default 'LG Main Gate') returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles; ps passes; res text; msg text; v visitors; pr parking_requests; o orders; ok boolean := true; ex boolean;
begin
  p := me();
  if not (p.portal in ('admin','staff')) then raise exception 'Only building staff can scan passes'; end if;
  select * into ps from passes where token = p_token for update;
  if ps.id is null then
    insert into pass_scans(token, gate, result, message, scanned_by) values (p_token, p_gate, 'not_found', 'Unknown pass', p.id);
    return jsonb_build_object('ok', false, 'result', 'not_found', 'message', 'Unknown or invalid pass');
  end if;
  ex := ps.status = 'active' and now() > ps.valid_to and not (ps.kind = 'parking' and ps.uses > 0);
  if ps.status = 'revoked' then ok := false; res := 'revoked'; msg := 'Pass revoked — do not admit';
  elsif ps.status in ('expired','used') or ex then
    if ex then
      update passes set status = 'expired' where id = ps.id;
      if ps.kind in ('parking','visitor') and ps.ticket_id is not null then perform _apply_status(ps.ticket_id, 'expired', 'Pass expired unused'); end if;
    end if;
    ok := false; res := 'expired'; msg := 'Pass expired';
  elsif now() < ps.valid_from - interval '30 minutes' then ok := false; res := 'too_early'; msg := 'Pass not valid yet (starts ' || to_char(ps.valid_from, 'HH24:MI') || ')';
  end if;

  if ok then
    if ps.kind = 'visitor' then
      select * into v from visitors where pass_id = ps.id;
      if ps.uses = 0 then
        update passes set uses = 1 where id = ps.id;
        update visitors set status = 'arrived', arrived_at = now() where id = v.id;
        perform _apply_status(ps.ticket_id, 'in_progress', 'Visitor arrived · scanned at ' || p_gate);
        if v.host_id is not null then perform _notify(v.host_id, '✅ ' || ps.holder_name || ' has arrived', 'Scanned at ' || p_gate || ' · allowed: ' || ps.zone, ps.ticket_id, 'success'); end if;
        res := 'entry'; msg := 'ADMIT · ' || ps.holder_name || ' → ' || ps.zone;
      else
        perform _apply_status(ps.ticket_id, 'fulfilled', 'Visitor exited via ' || p_gate);
        update passes set uses = ps.uses + 1, status = 'revoked' where id = ps.id;
        res := 'exit'; msg := 'EXIT recorded · pass closed';
      end if;
    elsif ps.kind = 'parking' then
      select * into pr from parking_requests where pass_id = ps.id;
      if pr.status = 'allocated' then
        update parking_bays set status = 'occupied' where id = pr.bay_id;
        update parking_requests set status = 'parked', entered_at = now() where id = pr.id;
        update passes set uses = 1, valid_to = now() + interval '24 hours' where id = ps.id;
        perform _apply_status(ps.ticket_id, 'in_progress', 'Vehicle entered · ' || ps.zone);
        res := 'entry'; msg := 'ENTRY · ' || coalesce(ps.meta->>'vehicle', '') || ' → ' || ps.zone;
      else
        perform _apply_status(ps.ticket_id, 'fulfilled', 'Vehicle exited · bay released');
        update passes set uses = 2 where id = ps.id;
        res := 'exit'; msg := 'EXIT · bay released';
      end if;
    elsif ps.kind = 'food_delivery' then
      update passes set uses = ps.uses + 1, status = case when ps.uses + 1 >= ps.max_uses then 'used' else status end where id = ps.id;
      select * into o from orders where id = (ps.meta->>'order')::uuid;
      if o.status = 'ready' then perform _advance_order(o.id, 'out_for_delivery', null); end if;
      res := 'entry'; msg := 'Runner verified · hand over at ' || coalesce(ps.zone, 'handover point') || ' only';
    else
      update passes set uses = ps.uses + 1, status = case when ps.uses + 1 >= ps.max_uses then 'used' else status end where id = ps.id;
      res := 'entry'; msg := 'Valid · ' || ps.kind || ' · ' || coalesce(ps.zone, '');
    end if;
  end if;
  perform _log_scan(ps, p_token, p_gate, res, msg);
  return jsonb_build_object('ok', ok, 'result', res, 'message', msg, 'kind', ps.kind, 'holder', ps.holder_name, 'zone', ps.zone);
end $$;

-- ================= SWEEP (expiry + SLA) =================
create or replace function public.expire_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in select * from passes where status = 'active' and valid_to < now() and not (kind = 'parking' and uses > 0) loop
    update passes set status = 'expired' where id = r.id;
    if r.kind in ('parking','visitor') and r.ticket_id is not null
       and exists (select 1 from tickets where id = r.ticket_id and status not in ('fulfilled','closed','cancelled','rejected','expired')) and r.uses = 0 then
      perform _apply_status(r.ticket_id, 'expired', 'Pass expired unused · resources released');
    end if;
    n := n + 1;
  end loop;
  for r in select * from tickets where status in ('routed','accepted','in_progress') and sla_due < now() loop
    update tickets set status = 'escalated', updated_at = now() where id = r.id;
    insert into ticket_events(ticket_id, actor_name, from_status, to_status, note) values (r.id, 'System', r.status, 'escalated', 'SLA breached');
    perform _notify_team(r.team, r.outlet_id, '⏰ SLA breached: ' || r.ref, r.title, r.id, 'warn');
    insert into notifications(user_id, title, body, ticket_id, level)
      select id, '⏰ SLA breached: ' || r.ref, r.title, r.id, 'warn' from profiles where portal = 'admin' and role_code in ('M1','M2') and active;
    n := n + 1;
  end loop;
  update bookings set status = 'completed' where status = 'confirmed' and ends_at < now();
  return n;
end $$;

-- ================= BOOKINGS =================
create or replace function public.book_resource(p_resource uuid, p_starts timestamptz, p_ends timestamptz, p_title text default null, p_attendees int default 1)
returns bookings language plpgsql security definer set search_path = public as $$
declare p profiles; r resources; b bookings; t tickets; st text;
begin
  p := me(); if p.id is null then raise exception 'Not signed in'; end if;
  select * into r from resources where id = p_resource for update;
  if r.id is null then raise exception 'Unknown resource'; end if;
  if p_ends <= p_starts then raise exception 'End must be after start'; end if;
  if p_starts < now() - interval '5 minutes' then raise exception 'Start time is in the past'; end if;
  if p_attendees > r.capacity then raise exception '% holds at most % people', r.name, r.capacity; end if;
  if exists (select 1 from bookings where resource_id = r.id and status in ('pending','confirmed') and tstzrange(starts_at, ends_at) && tstzrange(p_starts, p_ends)) then
    raise exception 'That slot is already booked';
  end if;
  st := case when r.needs_approval then 'pending' else 'confirmed' end;
  insert into bookings(resource_id, user_id, tenant_id, title, starts_at, ends_at, attendees, status)
  values (r.id, p.id, p.tenant_id, coalesce(p_title, r.name), p_starts, p_ends, p_attendees, st) returning * into b;
  if r.kind in ('event_space','ev_charger','carwash_slot') then
    t := _create_ticket(case r.kind when 'event_space' then 'event' when 'ev_charger' then 'ev' else 'carwash' end,
                        r.name || ' · ' || coalesce(p_title, 'booking'), to_char(p_starts, 'DD Mon HH24:MI') || ' – ' || to_char(p_ends, 'HH24:MI') || ' · ' || p_attendees || ' pax',
                        r.name, null, p.id, p.tenant_id, null, 'user', '{}');
    update bookings set ticket_id = t.id where id = b.id returning * into b;
    update tickets set linked_type = 'booking', linked_id = b.id where id = t.id;
    if not r.needs_approval then perform _apply_status(t.id, 'accepted', 'Slot confirmed'); end if;
  end if;
  return b;
end $$;

create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles; b bookings;
begin
  p := me(); select * into b from bookings where id = p_booking;
  if not (b.user_id = p.id or p.portal = 'admin') then raise exception 'Not allowed'; end if;
  update bookings set status = 'cancelled' where id = b.id;
  if b.ticket_id is not null then perform _apply_status(b.ticket_id, 'cancelled', 'Booking cancelled'); end if;
end $$;

create or replace function public.approve_booking(p_booking uuid, p_approve boolean, p_note text default null)
returns bookings language plpgsql security definer set search_path = public as $$
declare p profiles; b bookings; r resources; pt tickets; c record; kids text[] := array['event_catering','event_housekeeping','event_security','event_av','event_signage'];
begin
  p := me(); select * into b from bookings where id = p_booking for update; select * into r from resources where id = b.resource_id;
  if not (p.portal = 'admin' or (p.portal = 'staff' and p.team = 'events')) then raise exception 'Only management or events ops can approve'; end if;
  if b.status <> 'pending' then raise exception 'Already %', b.status; end if;
  select * into pt from tickets where id = b.ticket_id;
  if p_approve then
    update bookings set status = 'confirmed' where id = b.id returning * into b;
    perform _apply_status(pt.id, 'accepted', coalesce(p_note, 'Approved') || ' · linked tasks created');
    for c in select unnest(kids) as cat loop
      perform _create_ticket(c.cat, (select label from category_routes where category = c.cat) || ' · ' || b.title,
                             to_char(b.starts_at, 'DD Mon HH24:MI') || ' · ' || b.attendees || ' pax', r.name, null,
                             b.user_id, b.tenant_id, null, 'system', '{}', pt.id);
    end loop;
  else
    update bookings set status = 'rejected' where id = b.id returning * into b;
    perform _apply_status(pt.id, 'rejected', coalesce(p_note, 'Not approved'));
  end if;
  perform _audit('booking.decide', 'booking', b.id::text, jsonb_build_object('approved', p_approve));
  return b;
end $$;

-- ================= PARCELS =================
create or replace function public.register_parcel(p_recipient uuid, p_courier text, p_awb text default null)
returns tickets language plpgsql security definer set search_path = public as $$
declare p profiles; rc profiles; t tickets; pin text; lk text;
begin
  p := me(); select * into rc from profiles where id = p_recipient;
  if not (p.portal = 'admin' or (p.portal = 'staff' and p.team = 'parcel')) then raise exception 'Only the mailroom can register parcels'; end if;
  pin := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  lk := 'PL-' || lpad((floor(random() * 40) + 1)::int::text, 2, '0');
  t := _create_ticket('parcel', 'Parcel from ' || p_courier, 'AWB ' || coalesce(p_awb, 'n/a'), 'Mailroom · ' || lk, null, rc.id, rc.tenant_id, null, 'user',
                      jsonb_build_object('pin', pin, 'courier', p_courier, 'awb', p_awb, 'locker', lk));
  perform _apply_status(t.id, 'accepted', 'Parcel arrived · locker ' || lk || ' · collect with PIN ' || pin);
  select * into t from tickets where id = t.id;
  return t;
end $$;

create or replace function public.collect_parcel(p_ticket uuid, p_pin text) returns tickets
language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets;
begin
  p := me(); select * into t from tickets where id = p_ticket;
  if not _can_act(p, t) then raise exception 'Not allowed'; end if;
  if t.meta->>'pin' is distinct from p_pin then raise exception 'PIN does not match'; end if;
  return _apply_status(t.id, 'fulfilled', 'Collected · PIN verified');
end $$;

-- ================= DEVICES =================
create or replace function public.simulate_device_event(p_device uuid, p_event text, p_payload jsonb default '{}')
returns device_events language plpgsql security definer set search_path = public as $$
declare p profiles; d devices; ev device_events; rl record; t tickets; ids uuid[] := '{}'; sev text := 'warning';
begin
  p := me();
  if not (p.portal = 'admin' or (p.portal = 'staff' and p.team in ('bms','network','energy','security','fm'))) then raise exception 'Not allowed'; end if;
  select * into d from devices where id = p_device; if d.id is null then raise exception 'Unknown device'; end if;
  if p_event = 'reset' then
    update devices set status = 'online', last_event_at = now() where id = d.id;
    insert into device_events(device_id, event_type, severity, payload) values (d.id, 'reset', 'info', p_payload) returning * into ev;
    return ev;
  end if;
  for rl in select * from device_rules where event_type = p_event loop
    t := _create_ticket(rl.category, rl.title || ' · ' || d.name, 'Auto-raised from ' || d.code || coalesce(' · ' || (p_payload->>'reading'), ''),
                        d.location, rl.priority, null, null, null, 'device', jsonb_build_object('device', d.code, 'event', p_event) || p_payload, null, d.id);
    ids := ids || t.id;
    if rl.priority = 'critical' then sev := 'critical'; end if;
    if rl.notify_all_staff then
      insert into notifications(user_id, title, body, ticket_id, level)
      select id, '🚨 ' || rl.title, d.name || ' · ' || coalesce(d.location, ''), t.id, 'critical' from profiles where active;
    end if;
  end loop;
  if cardinality(ids) = 0 then raise exception 'No rule for event %', p_event; end if;
  update devices set status = case when sev = 'critical' then 'alarm' else 'fault' end, last_event_at = now() where id = d.id;
  insert into device_events(device_id, event_type, severity, payload, ticket_ids) values (d.id, p_event, sev, p_payload, ids) returning * into ev;
  perform _audit('device.event', 'device', d.code, jsonb_build_object('event', p_event, 'tickets', cardinality(ids)));
  return ev;
end $$;

-- ================= STOCK =================
create or replace function public.adjust_stock(p_item uuid, p_delta numeric, p_note text default null)
returns stock_items language plpgsql security definer set search_path = public as $$
declare p profiles; s stock_items;
begin
  p := me();
  if not (p.portal in ('admin','staff','outlet')) then raise exception 'Not allowed'; end if;
  update stock_items set qty = greatest(qty + p_delta, 0) where id = p_item returning * into s;
  if s.qty <= s.reorder_level and not s.low_alerted then
    update stock_items set low_alerted = true where id = s.id returning * into s;
    perform _create_ticket('low_stock', 'Low stock: ' || s.name || ' (' || s.qty || ' ' || s.unit || ' left)', 'Reorder level ' || s.reorder_level, s.location,
                           null, null, null, null, 'system', jsonb_build_object('item', s.code));
  elsif s.qty > s.reorder_level and s.low_alerted then
    update stock_items set low_alerted = false where id = s.id returning * into s;
  end if;
  perform _audit('stock.adjust', 'stock', s.code, jsonb_build_object('delta', p_delta, 'note', p_note));
  return s;
end $$;
-- ============================================================
-- PART 4: ROW LEVEL SECURITY, GRANTS, REALTIME
-- All writes go through RPC functions (security definer). Tables are read-only to clients
-- except: own notifications (mark read), menu items (outlet/admin), profile activation (admin).
-- ============================================================
create or replace function public.my_portal() returns text language sql stable security definer set search_path = public as $$ select portal from profiles where id = auth.uid() and active $$;
create or replace function public.my_team() returns text language sql stable security definer set search_path = public as $$ select team from profiles where id = auth.uid() and active $$;
create or replace function public.my_tenant() returns text language sql stable security definer set search_path = public as $$ select tenant_id from profiles where id = auth.uid() and active $$;
create or replace function public.my_outlet() returns text language sql stable security definer set search_path = public as $$ select outlet_id from profiles where id = auth.uid() and active $$;
create or replace function public.my_vendor() returns text language sql stable security definer set search_path = public as $$ select vendor_id from profiles where id = auth.uid() and active $$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$ select role_code from profiles where id = auth.uid() and active $$;

do $$ declare t text; begin
  foreach t in array array['tenants','outlets','vendors','locations','profiles','category_routes','tickets','ticket_events','notifications','audit_log',
    'feedback','menu_items','orders','passes','pass_scans','parking_bays','parking_requests','visitors','resources','bookings','devices',
    'device_events','device_rules','stock_items','charges'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- drop old policies so the script is re-runnable
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- reference data: any signed-in user
create policy ref_tenants on tenants for select to authenticated using (true);
create policy ref_outlets on outlets for select to authenticated using (true);
create policy ref_vendors on vendors for select to authenticated using (true);
create policy ref_locations on locations for select to authenticated using (true);
create policy ref_routes on category_routes for select to authenticated using (true);
create policy ref_profiles on profiles for select to authenticated using (true);
create policy ref_menu on menu_items for select to authenticated using (true);
create policy ref_resources on resources for select to authenticated using (true);
create policy ref_bays on parking_bays for select to authenticated using (true);
create policy ref_bookings on bookings for select to authenticated using (true);

-- admin can toggle accounts; outlet/admin manage their menu
create policy prof_admin_upd on profiles for update to authenticated using (is_admin()) with check (is_admin());
create policy menu_write on menu_items for all to authenticated
  using (is_admin() or (my_portal() = 'outlet' and outlet_id = my_outlet()))
  with check (is_admin() or (my_portal() = 'outlet' and outlet_id = my_outlet()));

-- tickets: who can see what
create policy t_select on tickets for select to authenticated using (
  is_admin() or requester_id = auth.uid()
  or (my_portal() = 'staff' and team = my_team())
  or (my_portal() = 'outlet' and outlet_id is not null and outlet_id = my_outlet())
  or (my_portal() = 'vendor' and vendor_id is not null and vendor_id = my_vendor())
  or (my_role() = 'T1' and tenant_id is not null and tenant_id = my_tenant() and category not in ('complaint'))
  or assignee_id = auth.uid()
);
create policy te_select on ticket_events for select to authenticated using (exists (select 1 from tickets t where t.id = ticket_id));
create policy fb_select on feedback for select to authenticated using (user_id = auth.uid() or is_admin() or my_team() = 'cs' or exists (select 1 from tickets t where t.id = ticket_id));
create policy o_select on orders for select to authenticated using (requester_id = auth.uid() or exists (select 1 from tickets t where t.id = ticket_id));
create policy pr_select on parking_requests for select to authenticated using (requester_id = auth.uid() or exists (select 1 from tickets t where t.id = ticket_id));
create policy ps_select on passes for select to authenticated using (host_id = auth.uid() or is_admin() or my_portal() = 'staff' or exists (select 1 from tickets t where t.id = ticket_id));
create policy sc_select on pass_scans for select to authenticated using (is_admin() or my_portal() = 'staff');
create policy v_select on visitors for select to authenticated using (
  host_id = auth.uid() or is_admin() or (my_portal() = 'staff' and my_team() in ('reception','security'))
  or (my_role() = 'T1' and tenant_id = my_tenant()));

-- notifications: own only
create policy n_select on notifications for select to authenticated using (user_id = auth.uid());
create policy n_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- operational data: admin + staff (+ outlet for stock)
create policy dev_select on devices for select to authenticated using (is_admin() or my_portal() = 'staff');
create policy devev_select on device_events for select to authenticated using (is_admin() or my_portal() = 'staff');
create policy devrule_select on device_rules for select to authenticated using (is_admin() or my_portal() = 'staff');
create policy stock_select on stock_items for select to authenticated using (is_admin() or my_portal() in ('staff','outlet'));
create policy audit_select on audit_log for select to authenticated using (is_admin());
create policy chg_select on charges for select to authenticated using (
  user_id = auth.uid() or is_admin() or (my_role() = 'T1' and tenant_id = my_tenant()));

-- ---------- function privileges ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like '\_%' escape '\' loop
    execute format('revoke execute on function %s from authenticated', r.sig);
  end loop;
end $$;
grant execute on function public.get_pass_public(text) to anon, authenticated;

-- ---------- realtime ----------
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tickets','ticket_events','notifications','orders','passes','visitors','parking_requests','parking_bays',
                             'bookings','devices','device_events','stock_items','charges'] loop
      begin execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null; end;
    end loop;
  end if;
end $$;
-- ============================================================
-- PART 5: SEED BUILDING DATA (safe to re-run)
-- ============================================================
insert into tenants(id, name, kind, floor, units, parking_quota) values
 ('tn_northwind','Northwind Analytics','office','4','401, 402',4),
 ('tn_helix','Helix Pharma India','office','5','501–503',6),
 ('tn_brightcart','BrightCart Retail','retail','UG','R-UG-01',2),
 ('tn_stayhub','StayHub Suites','hospitality','8','8F open plate',3),
 ('tn_summit','Summit Events Co','events',null,null,2),
 ('tn_adverto','Adverto Media','advertiser',null,null,0)
on conflict (id) do update set name = excluded.name;

insert into outlets(id, name, kind, team, location, tenant_id) values
 ('out_deck','Environment Deck Restaurant','restaurant','fnb','10th floor · Environment Deck',null),
 ('out_caffeine','Caffeine · Coffee Bar','cafe','coffee','Lower Ground · Reception',null),
 ('out_brightcart','BrightCart Store','retail',null,'Upper Ground','tn_brightcart'),
 ('out_laundry','FreshFold Laundry','laundry','laundry','B2 · Laundry room',null),
 ('out_carwash','ShineWorks Car Wash','carwash','carwash','B4 · Wash bay',null),
 ('out_wellness','ZenSpace Wellness','wellness','wellness','Mezzanine',null),
 ('out_pharmacy','Pharmacy & ATM Kiosk','other',null,'Upper Ground',null)
on conflict (id) do update set name = excluded.name;

insert into vendors(id, name, category) values
 ('vn_mep','CoolAire MEP Services','X1 · MEP / maintenance'),
 ('vn_lift','Skyline Lifts & Escalators','X2 · Lift contractor'),
 ('vn_isp','NetCore Broadband','X3 · IT / ISP / network'),
 ('vn_clean','PureServe Facility Services','X4 · Cleaning / pest / waste'),
 ('vn_supply','FreshCrate Suppliers','X5 · Food & amenity supplier'),
 ('vn_ev','VoltGrid EV Systems','X6 · EV / power specialist'),
 ('vn_spec','Apex Specialist Works','X8 · Other specialist')
on conflict (id) do update set name = excluded.name;

-- ---------- ticket categories & routing ----------
insert into category_routes(category, label, team, also_team, sla_minutes, priority, tenant_facing, icon) values
 ('food','Food order','fnb',null,60,'normal',true,'utensils'),
 ('coffee','Coffee order','coffee',null,30,'normal',true,'coffee'),
 ('parking','Parking','parking',null,20,'normal',true,'car'),
 ('valet','Valet request','valet',null,30,'normal',true,'key'),
 ('visitor','Visitor','reception',null,240,'normal',false,'users'),
 ('housekeeping','Housekeeping','housekeeping',null,60,'normal',true,'sparkles'),
 ('laundry','Laundry / ironing','laundry',null,480,'normal',true,'shirt'),
 ('maintenance','General maintenance','fm',null,240,'normal',true,'wrench'),
 ('hvac','AC / temperature','fm',null,120,'normal',true,'thermometer'),
 ('electrical','Electrical','mep',null,120,'normal',true,'zap'),
 ('plumbing','Plumbing / leak','mep',null,120,'high',true,'droplets'),
 ('it_wifi','Wi-Fi / IT support','it_av',null,120,'normal',true,'wifi'),
 ('av','Conference AV fault','it_av',null,60,'normal',true,'monitor'),
 ('it_provision','Internet provisioning','it_support',null,2880,'normal',true,'network'),
 ('network_security','Network security incident','network',null,30,'high',false,'shield'),
 ('printing','Business centre / printing','concierge',null,60,'normal',true,'printer'),
 ('concierge','Concierge request','concierge',null,120,'normal',true,'bell'),
 ('parcel','Parcel','parcel',null,240,'normal',false,'package'),
 ('ev','EV charging','ev',null,60,'normal',true,'plug'),
 ('carwash','Car wash','carwash',null,120,'normal',true,'droplet'),
 ('medical_sos','Medical SOS','medical','security',5,'critical',true,'heart-pulse'),
 ('creche','Creche','creche',null,120,'normal',true,'baby'),
 ('event','Event / space booking','events',null,1440,'normal',true,'party-popper'),
 ('event_catering','Event catering','fnb',null,1440,'normal',false,'utensils'),
 ('event_housekeeping','Event housekeeping','housekeeping',null,1440,'normal',false,'sparkles'),
 ('event_security','Event security','security',null,1440,'normal',false,'shield'),
 ('event_av','Event AV setup','it_av',null,1440,'normal',false,'monitor'),
 ('event_signage','Event signage','signage',null,1440,'normal',false,'tv'),
 ('signage','Signage / ad request','signage',null,1440,'normal',true,'tv'),
 ('waste','Waste pickup','waste',null,240,'normal',true,'trash'),
 ('ewaste','E-waste pickup','waste',null,2880,'normal',true,'recycle'),
 ('pest','Pest control','pest',null,1440,'normal',true,'bug'),
 ('shuttle','Shuttle / cab pool','transport',null,60,'normal',true,'bus'),
 ('wellness','Wellness / gym','wellness',null,120,'normal',true,'dumbbell'),
 ('landscape','Landscaping / green belt','landscape',null,2880,'normal',false,'trees'),
 ('fitout','Fit-out / move-in','pmo',null,2880,'normal',true,'hammer'),
 ('complaint','Service complaint','cs',null,240,'high',false,'message-square-warning'),
 ('device_fault','Device / BMS fault','bms',null,60,'high',false,'cpu'),
 ('fire_alarm','Fire alarm','security',null,5,'critical',false,'flame'),
 ('lift_fault','Lift fault','fm',null,60,'high',false,'arrow-up-down'),
 ('pump_fault','Pump fault','mep',null,60,'high',false,'gauge'),
 ('energy_alert','Energy / water alert','energy',null,120,'normal',false,'bolt'),
 ('security_incident','Security incident','security',null,15,'high',false,'siren'),
 ('cctv_review','CCTV review request','cctv',null,240,'normal',false,'video'),
 ('low_stock','Low stock reorder','stores',null,480,'normal',false,'boxes')
on conflict (category) do update set label = excluded.label, team = excluded.team, also_team = excluded.also_team,
  sla_minutes = excluded.sla_minutes, priority = excluded.priority, tenant_facing = excluded.tenant_facing, icon = excluded.icon;

insert into device_rules(event_type, category, priority, title, notify_all_staff) values
 ('fire_alarm','fire_alarm','critical','FIRE ALARM',true),
 ('fire_alarm','device_fault','high','Fire panel zone fault check',false),
 ('lift_fault','lift_fault','high','Lift fault',false),
 ('lift_entrapment','lift_fault','critical','Lift entrapment',false),
 ('lift_entrapment','security_incident','critical','Lift entrapment — attend',false),
 ('pump_fault','pump_fault','high','Pump fault',false),
 ('hvac_high_temp','hvac','normal','High temperature reading',false),
 ('hvac_high_temp','device_fault','normal','AHU alarm',false),
 ('water_leak','plumbing','high','Water leak detected',false),
 ('tank_low','energy_alert','normal','Water tank level low',false),
 ('network_outage','it_wifi','high','Network outage',false),
 ('network_outage','network_security','high','Network outage triage',false),
 ('wifi_weak','it_wifi','normal','Weak Wi-Fi signal reports',false),
 ('power_failure','electrical','critical','Power failure — DG changeover',false),
 ('power_failure','energy_alert','high','Power quality alarm',false),
 ('ev_fault','ev','high','EV charger fault',false),
 ('anpr_blacklist','security_incident','high','Blacklisted vehicle at gate',false)
on conflict (event_type, category) do update set title = excluded.title, priority = excluded.priority;

-- ---------- locations ----------
insert into locations(id, level, name, kind)
select 'L-' || lvl, lvl, nm, 'level' from (values
 ('B4','Basement 4'),('B3','Basement 3'),('B2','Basement 2'),('B1','Basement 1'),('LG','Lower Ground'),('UG','Upper Ground'),
 ('F1','First floor'),('F2','Second floor'),('F3','Third floor'),('F4','Fourth floor'),('F5','Fifth floor'),('F6','Sixth floor'),
 ('F7','Seventh floor'),('F8','Eighth floor (hospitality)'),('F9','Ninth floor (hospitality)'),('F10','Tenth · Environment Deck'),
 ('FM','Mezzanine'),('F11','Eleventh floor'),('F12','Twelfth floor'),('TR','Terrace')) v(lvl, nm)
on conflict (id) do nothing;
insert into locations(id, level, name, kind)
select 'U-' || f || lpad(n::text, 2, '0'), 'F' || f, 'Unit ' || f || lpad(n::text, 2, '0'), 'unit'
from generate_series(3,5) f, generate_series(1,8) n on conflict (id) do nothing;
insert into locations(id, level, name, kind)
select 'U-6' || lpad(n::text, 2, '0'), 'F6', 'Unit 6' || lpad(n::text, 2, '0'), 'unit' from generate_series(2,8) n on conflict (id) do nothing;
insert into locations(id, level, name, kind) values
 ('R-LG-CR','LG','Conference Room (LG)','room'),('R-LG-RC','LG','Reception','zone'),('R-LG-CR1','LG','Kids Creche','room'),
 ('R-LG-MED','LG','Medical Room','room'),('R-LG-BC','LG','Business Centre','room'),('R-LG-DL','LG','Digital Lockers','zone'),
 ('R-LG-SRV','LG','IT Server Room','room'),('R-LG-BMS','LG','BMS Room','room'),('R-B1-FP','B1','Fire Pump Room','room'),
 ('R-B2-LND','B2','Laundry Room','room'),('R-B4-STP','B4','STP Area','room'),('R-F10-RST','F10','Restaurant','zone'),
 ('R-F10-KIT','F10','Central Kitchen','zone'),('R-F10-EV','F10','Events Space','zone')
on conflict (id) do nothing;

-- ---------- menus ----------
delete from menu_items where outlet_id in ('out_deck','out_caffeine');
insert into menu_items(outlet_id, name, description, price, section) values
 ('out_deck','Butter Chicken Bowl','Basmati rice, makhani gravy, pickled onion',349,'Mains'),
 ('out_deck','Paneer Tikka Wrap','Charred paneer, mint chutney, slaw',259,'Mains'),
 ('out_deck','Hyderabadi Veg Biryani','Slow-cooked, raita on the side',299,'Mains'),
 ('out_deck','Grilled Chicken Caesar','Romaine, parmesan, sourdough croutons',329,'Salads'),
 ('out_deck','Quinoa & Avocado Salad','Citrus dressing, toasted seeds',289,'Salads'),
 ('out_deck','Margherita Flatbread','Fresh basil, buffalo mozzarella',319,'Mains'),
 ('out_deck','Tiramisu Cup','Espresso-soaked sponge',179,'Desserts'),
 ('out_deck','Fresh Lime Soda','Sweet / salted / mixed',99,'Drinks'),
 ('out_caffeine','Flat White','Double shot, steamed milk',189,'Coffee'),
 ('out_caffeine','Cappuccino','Classic, silky foam',179,'Coffee'),
 ('out_caffeine','Cold Brew','12-hour steep',199,'Coffee'),
 ('out_caffeine','Masala Chai','Cardamom, ginger',99,'Tea'),
 ('out_caffeine','Almond Croissant','Baked in-house',169,'Bakes'),
 ('out_caffeine','Blueberry Muffin','',129,'Bakes');

-- ---------- parking bays (car 228 incl. LG 28; bikes 163) ----------
insert into parking_bays(code, level, vtype, zone, status)
select lvl || '-C-' || lpad(n::text, 3, '0'), lvl, 'car',
  case when lvl = 'LG' and n <= 8 then 'visitor' when lvl = 'LG' and n <= 12 then 'ev' when lvl = 'LG' and n <= 14 then 'accessible' else 'tenant' end,
  case when lvl = 'LG' and n <= 14 then 'free' when n % 3 = 0 then 'occupied' else 'free' end
from (values ('B4',56),('B3',52),('B2',46),('B1',46),('LG',28)) v(lvl, cnt), generate_series(1, 100) n where n <= cnt
on conflict (code) do nothing;
insert into parking_bays(code, level, vtype, zone, status)
select lvl || '-B-' || lpad(n::text, 3, '0'), lvl, 'bike',
  case when lvl = 'B2' then 'staff' when lvl = 'LG' and n <= 10 then 'delivery' else 'tenant' end,
  case when n % 4 = 0 then 'occupied' else 'free' end
from (values ('B4',8),('B3',10),('B2',50),('LG',95)) v(lvl, cnt), generate_series(1, 100) n where n <= cnt
on conflict (code) do nothing;

-- ---------- bookable resources ----------
insert into resources(code, name, kind, level, capacity, needs_approval) values
 ('RM-LG-CR1','Conference Room (16 seats)','room','LG',16,false),
 ('RM-2F-A','Boardroom 2F-A','room','F2',10,false),
 ('RM-2F-B','Huddle 2F-B','room','F2',4,false),
 ('RM-2F-C','Huddle 2F-C','room','F2',4,false),
 ('EV-SPACE','Environment Deck · Events Space','event_space','F10',120,true),
 ('AMPHI','Amphitheatre','event_space','F10',80,true),
 ('CW-1','Wash Bay 1','carwash_slot','B4',1,false)
on conflict (code) do nothing;
insert into resources(code, name, kind, level, capacity)
select 'DESK-2F-' || lpad(n::text, 2, '0'), 'Desk 2F-' || lpad(n::text, 2, '0'), 'desk', 'F2', 1 from generate_series(1,12) n on conflict (code) do nothing;
insert into resources(code, name, kind, level, capacity)
select 'LOCK-' || lpad(n::text, 2, '0'), 'Locker L-' || lpad(n::text, 2, '0'), 'locker', 'LG', 1 from generate_series(1,24) n on conflict (code) do nothing;
insert into resources(code, name, kind, level, capacity)
select 'EV-' || lpad(n::text, 2, '0'), 'EV Charger ' || lpad(n::text, 2, '0'), 'ev_charger', 'LG', 1 from generate_series(1,4) n on conflict (code) do nothing;

-- ---------- devices (D1–D16) ----------
insert into devices(code, name, kind, location) values
 ('D01','ANPR Entry Camera','anpr','LG · Main entry'),('D02','ANPR Exit Camera','anpr','LG · Exit'),
 ('D03','QR Turnstile','access','LG · Reception'),('D04','Main Lift 1','lift','Main lift lobby'),
 ('D05','Executive Lift','lift','Executive lift lobby'),('D06','Service Lift','lift','Service lift lobby'),
 ('D07','Fire Alarm Panel','fire','LG · Electrical panel room'),('D08','BMS Controller','bms','LG · BMS room'),
 ('D09','AHU-4F','hvac','4th floor · Plant'),('D10','Fire Pump P1','pump','B1 · Fire pump room'),
 ('D11','Treated Water Tank','water','B1 · Tank room'),('D12','STP Controller','stp','B4 · STP area'),
 ('D13','EV Charger 01','ev','LG · EV bays'),('D14','Core Network Switch','network','LG · IT server room'),
 ('D15','Wi-Fi AP 5F-02','wifi','5th floor'),('D16','Main Electrical Meter','meter','LG · Electrical panel room')
on conflict (code) do nothing;

-- ---------- stock ----------
insert into stock_items(code, name, category, qty, reorder_level, unit, location) values
 ('LIN-TWL','Bath towels','linen',120,40,'pcs','Linen storage · 8F'),
 ('LIN-BED','Bed sheets','linen',80,30,'pcs','Linen storage · 9F'),
 ('JAN-CHM','Floor cleaning chemical','janitorial',14,6,'l','B1 · Janitor room'),
 ('JAN-BAG','Garbage bags','janitorial',300,100,'pcs','B1 · Janitor room'),
 ('CAF-BEAN','Coffee beans','kitchen',7,5,'kg','LG · Coffee bar'),
 ('CAF-MILK','Milk','kitchen',20,8,'l','LG · Coffee bar'),
 ('CAF-CUP','Paper cups','kitchen',500,200,'pcs','LG · Coffee bar'),
 ('PAN-TEA','Tea bags','pantry',400,150,'pcs','Floor pantries'),
 ('MED-BND','First-aid bandages','medical',25,10,'pcs','LG · Medical room'),
 ('MNT-FLT','AHU filters','spares',10,4,'pcs','B1 · Store'),
 ('IT-TON','Printer toner','spares',6,3,'pcs','LG · Business centre'),
 ('UNI-SHT','Staff uniform shirts','uniform',60,20,'pcs','B2 · Locker rooms')
on conflict (code) do update set name = excluded.name;
