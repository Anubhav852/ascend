import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, useAuth } from '../lib/req';
import { emailFor } from '../config/roles';

export default function PanelEntry() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [err, setErr] = useState('');
  const want = (sp.get('as') || '').toUpperCase();
  const to = sp.get('to') || '/';

  useEffect(() => {
    (async () => {
      const { data } = await db.auth.getSession();
      if (data.session && data.session.user && data.session.user.email === emailFor(want)) return;
      const { error } = await db.auth.signInWithPassword({ email: emailFor(want), password: 'Demo@1234' });
      if (error) setErr(error.message);
    })();
  }, [want]);

  useEffect(() => {
    if (profile && profile.role_code === want) nav(to, { replace: true });
  }, [profile, want, to, nav]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      {err ? 'Could not open the portal: ' + err : 'Opening ' + want + '...'}
    </div>
  );
}