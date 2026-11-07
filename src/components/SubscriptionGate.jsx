import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Regla de acceso:
//  - subscription_active = false  → bloqueado (baja manual del admin)
//  - sin fecha y plan 'pro'       → acceso de por vida (gratis x vida)
//  - con fecha                    → vigente si no venció
// Si falla la consulta (tabla ausente), deja pasar (fail-open) para no bloquear la app por error.
export function isSubscriptionValid(profile) {
  if (!profile) return true;
  if (profile.subscription_active === false) return false;
  if (!profile.trial_ends_at) return profile.subscription_plan === 'pro';
  return Date.now() < new Date(profile.trial_ends_at).getTime();
}

export default function SubscriptionGate({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState('checking'); // 'checking' | 'allowed' | 'blocked'

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user?.id) {
        if (!cancelled) setState('allowed');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_plan, subscription_active, trial_ends_at')
          .eq('id', user.id)
          .single();

        if (cancelled) return;
        if (error || !data) {
          console.error('Subscription check error:', error);
          setState('allowed'); // fail-open
          return;
        }
        setState(isSubscriptionValid(data) ? 'allowed' : 'blocked');
      } catch (e) {
        console.error('Subscription check exception:', e);
        if (!cancelled) setState('allowed');
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (authLoading || state === 'checking') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (state === 'blocked') return <Navigate to="/suscripcion" replace />;

  return children || <Outlet />;
}
