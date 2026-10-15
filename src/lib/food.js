export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const ORDER_STEPS = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
export const STEP_SHORT = { placed: 'Placed', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'On the way', delivered: 'Delivered' };
export const ORDER_LABEL = {
  placed: 'Order placed', accepted: 'Accepted', preparing: 'Being prepared', ready: 'Ready',
  out_for_delivery: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Declined',
};
export const ORDER_TONE = {
  placed: 'slate', accepted: 'blue', preparing: 'violet', ready: 'amber',
  out_for_delivery: 'amber', delivered: 'green', cancelled: 'slate', rejected: 'red',
};
export const orderNo = (ref) => 'ORD-' + (ref || '').replace(/\D/g, '');
export const passUrl = (token) => `${window.location.origin}/pass/${token}`;