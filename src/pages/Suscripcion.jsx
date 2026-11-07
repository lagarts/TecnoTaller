import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, CheckCircle, Clock, XCircle, ArrowRight, LogOut,
  ExternalLink, ShieldCheck, Wrench
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isSubscriptionValid } from '../components/SubscriptionGate';

const PLANS = [
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    amount: 15000,
    currency: 'ARS',
    display: '$15.000',
    unit: 'por mes (pesos argentinos)',
    badge: 'MP',
    badgeClass: 'bg-blue-500',
    btnClass: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    amount: 10,
    currency: 'USD',
    display: 'US$10',
    unit: 'por mes (dólares)',
    badge: 'PP',
    badgeClass: 'bg-yellow-500',
    btnClass: 'bg-yellow-600 hover:bg-yellow-700',
  },
];

export default function Suscripcion() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState({ mp_link: '', paypal_link: '' });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    try {
      const [pRes, sRes, payRes] = await Promise.all([
        supabase.from('profiles')
          .select('subscription_plan, subscription_active, trial_ends_at')
          .eq('id', user.id)
          .single(),
        supabase.from('app_settings').select('key, value'),
        supabase.from('subscription_payments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (!pRes.error && pRes.data) setProfile(pRes.data);
      if (!sRes.error) {
        const map = {};
        (sRes.data || []).forEach(r => { map[r.key] = r.value; });
        setSettings({ mp_link: map.mp_link || '', paypal_link: map.paypal_link || '' });
      }
      if (!payRes.error) setPayments(payRes.data || []);
    } catch (e) {
      console.error('Error loading subscription:', e);
    } finally {
      setLoading(false);
    }
  };

  const valid = isSubscriptionValid(profile);
  const latest = payments[0];
  const pending = latest?.status === 'pendiente';
  const accessUntil = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isLifetime = valid && !profile?.trial_ends_at && profile?.subscription_plan === 'pro';
  const daysLeft = accessUntil ? Math.ceil((accessUntil.getTime() - Date.now()) / 86400000) : null;
  const isTrial = valid && profile?.subscription_plan !== 'pro';

  const handleDeclare = async (plan) => {
    const ok = confirm(
      `¿Ya realizaste el pago de ${plan.display} con ${plan.name}?\n\n` +
      `Se enviará a verificación y vas a tener 3 días de acceso temporal mientras se aprueba.`
    );
    if (!ok) return;
    setDeclaring(true);
    const { error } = await supabase.rpc('declare_subscription_payment', {
      p_method: plan.id,
      p_amount: plan.amount,
      p_currency: plan.currency,
    });
    setDeclaring(false);
    if (error) {
      alert('No se pudo registrar: ' + (error.message || 'error desconocido'));
      return;
    }
    await load();
    showToast('Pago enviado a verificación ✓ — acceso temporal de 3 días');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1219] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1219] flex flex-col">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logopwa.ico" alt="TecnoTaller" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-white">
            <span className="text-blue-400">Tecno</span>Taller
          </span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-lg space-y-5">

          {/* Estado */}
          {!valid ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center">
              <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-white">Suscripción vencida</h1>
              <p className="text-gray-400 text-sm mt-2">
                Tu período gratis terminó. Para seguir usando TecnoTaller,
                elegí un medio de pago y renová la suscripción.
              </p>
            </div>
          ) : pending ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
              <Clock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-white">Pago en verificación</h1>
              <p className="text-gray-400 text-sm mt-2">
                Registramos tu pago de {latest?.display || ''}. Estamos verificándolo —
                tu acceso temporal llega hasta{' '}
                <span className="text-yellow-300 font-medium">
                  {accessUntil?.toLocaleDateString('es-AR')}
                </span>.
              </p>
              <button onClick={() => navigate('/inicio')} className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Entrar a la app
              </button>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-white">
                {isLifetime ? 'Acceso activo de por vida' : isTrial ? 'Prueba gratuita activa' : 'Suscripción activa'}
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                {isLifetime
                  ? 'Tenés acceso gratis de por vida. ¡Gracias por confiar!'
                  : `Tu acceso está vigente hasta el ${accessUntil?.toLocaleDateString('es-AR')}` +
                    (daysLeft !== null ? ` (${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''})` : '')}
              </p>
              <button onClick={() => navigate('/inicio')} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
                Entrar a la app
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Medios de pago */}
          <div>
            <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">
              Medios de pago — 1 mes gratis ya incluido
            </p>
            <div className="space-y-3">
              {PLANS.map(plan => {
                const link = plan.id === 'mercadopago' ? settings.mp_link : settings.paypal_link;
                return (
                  <div key={plan.id} className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex items-center gap-4">
                    <div className={`w-11 h-11 ${plan.badgeClass} rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0`}>
                      {plan.badge}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold">{plan.name}</p>
                      <p className="text-gray-400 text-xs">{plan.unit}</p>
                      <p className="text-white font-bold text-lg mt-0.5">{plan.display}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <a
                        href={link || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => { if (!link) { e.preventDefault(); alert('Link de pago no configurado. Pedile al administrador que lo cargue en Configuración.'); } }}
                        className={`flex items-center justify-center gap-1.5 ${plan.btnClass} text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Pagar
                      </a>
                      <button
                        onClick={() => handleDeclare(plan)}
                        disabled={declaring}
                        className="flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Ya pagué
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-600 mt-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Al tocar "Ya pagué" tenés 3 días de acceso temporal hasta que el pago sea verificado.
            </p>
          </div>

          {/* Historial de pagos */}
          {payments.length > 0 && (
            <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
              <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">Mis pagos</p>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-white capitalize">{p.method === 'mercadopago' ? 'Mercado Pago' : 'PayPal'} — {p.currency === 'USD' ? `US$${Number(p.amount)}` : `$${Number(p.amount).toLocaleString()}`}</p>
                      <p className="text-[11px] text-gray-500">{new Date(p.created_at).toLocaleString('es-AR')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase flex items-center gap-1 flex-shrink-0 ${
                      p.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-300'
                      : p.status === 'pendiente' ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                    }`}>
                      {p.status === 'aprobado' ? <CheckCircle className="w-3 h-3" /> : p.status === 'pendiente' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center pb-6">
            <p className="text-[11px] text-gray-600 flex items-center justify-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              TecnoTaller — Soluciones Automotrices
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
