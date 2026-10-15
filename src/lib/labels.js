// Everyday wording. Database names stay technical; people see these.
const STATUS = {
  raised: 'Submitted', routed: 'Sent to team', accepted: 'Accepted', in_progress: 'In progress',
  fulfilled: 'Completed', closed: 'Closed', rejected: 'Declined', cancelled: 'Cancelled',
  expired: 'Expired', on_hold: 'On hold', escalated: 'Escalated',
};
const PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', critical: 'Urgent' };

export const statusLabel = (s) => STATUS[s] || (s || '').replace(/_/g, ' ');
export const priorityLabel = (p) => PRIORITY[p] || p;
export const reqRef = (ref) => (ref || '').replace(/^TKT-/, 'REQ-');

// What the list of items is called, per portal
export const listTitle = (portal) => ({
  tenant: 'My requests',
  staff: 'Work queue',
  outlet: 'Incoming orders & requests',
  vendor: 'Assigned work orders',
  admin: 'All requests',
}[portal] || 'Requests');