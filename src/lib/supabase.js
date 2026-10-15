import { createClient as __cc } from '@supabase/supabase-js';
// Reviewer side panel: the iframe named ascend-panel keeps its own login so it never touches the main session.
const __panel = typeof window !== 'undefined' && window.name === 'ascend-panel';
const createClient = (u, k, o = {}) => __cc(u, k, __panel ? { ...o, auth: { ...(o.auth || {}), storageKey: 'ascend-panel-auth' } } : o);

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const missingEnv = !url || !key || url.includes('your-');

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key');