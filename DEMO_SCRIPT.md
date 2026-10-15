# Demo script (about 12 minutes)

Use two browsers, or one normal window plus incognito. Reset first if needed (Reset demo SQL, then npm run seed-users).

## 0. Opening line (30 s)
"One building system, five portals. Every flow you will see runs on the same request, pass and booking engines. The roles are configuration, not separate apps."

## 1. Management view (1 min)
Log in as m1. Dashboard, then User Portals. Show that one click opens any role and Return to Admin comes back.

## 2. Food and coffee (2 min)
T2 orders from Caffeine. In the second browser O2 accepts with an ETA, prepares, marks ready. T2 sees the live progress bar and the runner pass QR. Hand over, rate 5 stars. Open Billing as admin: the charge is billed.

## 3. Service request to vendor work order (2 min)
T2: Request anything, type "the AC is too cold", pick the suggestion, send. S12 assigns it, sends it to MEP, S13 sends a work order to CoolAire. X1 sees only that job, with a permit QR, and completes it. T2 closes and rates.
Point out: X2 (lift vendor) and S09 cannot see it.

## 4. Parking with the 15-minute QR (2 min)
T2 requests a bay, S04 allocates, T2 sees the countdown QR. Scan at the gate: entry. Scan again: exit and the bay is freed. Mention the tenant quota.

## 5. Visitor with public pass page (1 min)
T2 invites a visitor. Open the pass link in incognito (no login). S02 scans it; the host is notified and the page updates.

## 6. Event with 5 linked tasks (1 min)
T6 books the Environment Deck. S08 approves. Catering, housekeeping, security, AV and signage each get a task.

## 7. Emergency and devices (2 min)
Admin: Devices, fire alarm on D07. Every user gets a critical notification (T2 bell). Open Building: the Lower Ground row turns red. Show the auto-raised requests. Then lift entrapment on D04. Reset both.

## 8. Management depth (1 min)
Analytics, Audit log (every step above is recorded), Roles matrix, Compliance (raise an inspection task).

## Be upfront
- Devices are simulated; real ANPR, BMS and fire panels connect through the same event contract.
- Creche, valet, laundry, roll-call, asset register and similar flows reuse the generic request engine. This is the same-engine point, not a gap.
- Certificates other than IGBC Gold and ECBC are sample data.