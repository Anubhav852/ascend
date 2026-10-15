import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { emailFor } from '../config/roles';

const DEMO_PASSWORD = 'Demo@1234';
const RETURN_KEY = 'ascend_return_to';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [prof, setProf] = useState({ id: null, data: null });
  const [returnTo, setReturnTo] = useState(() => sessionStorage.getItem(RETURN_KEY));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) return;
    let cancel = false;
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data }) => {
      if (!cancel) setProf({ id: uid, data: data || null });
    });
    return () => { cancel = true; };
  }, [uid]);

  const profile = uid && prof.id === uid ? prof.data : null;
  const loading = session === undefined || (!!uid && prof.id !== uid);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(RETURN_KEY); setReturnTo(null);
    await supabase.auth.signOut();
  }, []);

  // Admin "open portal": sign in as a role's demo account, remember the admin to return to.
  const openAs = useCallback(async (code) => {
    if (profile?.portal === 'admin' && !returnTo) {
      sessionStorage.setItem(RETURN_KEY, profile.email); setReturnTo(profile.email);
    }
    return signIn(emailFor(code), DEMO_PASSWORD);
  }, [profile, returnTo, signIn]);

  const returnToAdmin = useCallback(async () => {
    const email = returnTo;
    sessionStorage.removeItem(RETURN_KEY); setReturnTo(null);
    if (!email) return { error: null };
    return signIn(email, DEMO_PASSWORD);
  }, [returnTo, signIn]);

  return (
    <Ctx.Provider value={{ session, profile, loading, signIn, signOut, openAs, returnTo, returnToAdmin, DEMO_PASSWORD }}>
      {children}
    </Ctx.Provider>
  );
}