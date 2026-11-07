import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lock, CheckCircle, Clock, XCircle, ArrowRight, LogOut,
  ExternalLink, ShieldCheck, Wrench, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isSubscriptionValid } from '../components/SubscriptionGate';

const MP_AMOUNT = 15000;
const PAYPAL_AMOUNT = '10.00';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

export default function Suscripcion() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState({ mp_link: '', paypal_link: '' });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingMP, setPayingMP] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [toast, setToast] = useState(null);
  const [pagoResult, setPagoResult] = useState(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => { load(); }, []);

  // Al volver de un pago (?pago=ok/pendiente/fallo), muestra el resultado y
  // sondea el perfil hasta que la suscripción se active
  useEffect(() => {
    const pago = searchParams.get('pago');
    if (!pago) return;
    if (pago === 'ok' || pago === 'pendiente') {
      setPagoResult('ok');
      startPolling();
    } else {
      setPagoResult('fallo');
    }
    // limpiamos la query string para que no se repita al recargar
    navigate('/suscripcion', { replace: true });
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    stopPolling();
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts += 1;
      await load();
      if (attempts >= 20) stopPolling(); // ~60 segundos máximo
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  // Si durante el sondeo la suscripción se activa, mostramos éxito y dejamos de sondear
  useEffect(() => {
    if (pollingRef.current && isSubscriptionValid(profile)) {
      stopPolling();
      setPagoResult('ok');
      showToast('¡Pago confirmado! Suscripción activada ✓');
    }
  }, [profile]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
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
  const accessUntil = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isLifetime = valid && !profile?.trial_ends_at && profile?.subscription_plan === 'pro';
  const daysLeft = accessUntil ? Math.ceil((accessUntil.getTime() - Date.now()) / 86400000) : null;
  const isTrial = valid && profile?.subscription_plan !== 'pro';

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  // ---------- Mercado Pago: Checkout Pro automático ----------
  const payWithMercadoPago = async () => {
    setPayingMP(true);
    try {
      const token = await getToken();
      if (!token) { navigate('/login'); return; }

      const res = await fetch('/api/mp-preference', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.init_point) {
        window.location.href = data.init_point; // redirige al checkout oficial de MP
        return;
      }
      // Fallback: link estático configurado por el admin
      if (settings.mp_link) {
        window.open(settings.mp_link, '_blank');
        showToast('Se abrió el link de pago. Volvé a la app después de pagar.');
      } else {
        alert('El pago con Mercado Pago no está disponible todavía.\n\n' + (data.error || 'Contactá al administrador.'));
      }
    } catch (e) {
      console.error('MP payment error:', e);
      if (settings.mp_link) window.open(settings.mp_link, '_blank');
      else alert('No se pudo iniciar el pago con Mercado Pago.');
    } finally {
      setPayingMP(false);
    }
  };

  // ---------- PayPal: botones oficiales ----------
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID) return;
    if (window.paypal) { setPaypalReady(true); return; }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    script.onerror = () => console.error('No se pudo cargar el SDK de PayPal');
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!paypalReady || !window.paypal) return;
    const container = document.getElementById('paypal-buttons');
    if (!container) return;

    window.paypal.Buttons({
      style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'pay' },
      createOrder: async () => {
        const token = await getToken();
        if (!token) { navigate('/login'); return; }
        const res = await fetch('/api/paypal-create-order', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear la orden');
        return data.id;
      },
      onApprove: async (data) => {
        const token = await getToken();
        const res = await fetch('/api/paypal-capture', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID: data.orderID }),
        });
        const result = await res.json();
        if (res.ok && result.ok) {
          await load();
          showToast('¡Pago confirmado! Suscripción activada por 1 mes ✓');
        } else if (res.ok && result.status) {
          showToast('Pago en proceso, se activa en unos segundos…');
          startPolling();
        } else {
          alert('No se pudo confirmar el pago: ' + (result.error || 'error desconocido'));
        }
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        if (settings.paypal_link) window.open(settings.paypal_link, '_blank');
      },
    }).render('#paypal-buttons');

    return () => { container.innerHTML = ''; };
  }, [paypalReady]);

  // ---------- Fallback manual ----------
  const handleDeclare = async () => {
    const ok = confirm(
      '¿Ya realizaste el pago?\n\n' +
      'Se enviará a verificación y vas a tener 3 días de acceso temporal mientras se confirma.'
    );
    if (!ok) return;
    setDeclaring(true);
    const { error } = await supabase.rpc('declare_subscription_payment', {
      p_method: 'mercadopago',
      p_amount: MP_AMOUNT,
      p_currency: 'ARS',
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
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm shadow-lg max-w-xs">
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
                Tu período gratis terminó. Elegí un medio de pago y pagá —
                la suscripción se activa <strong className="text-white">automáticamente</strong> al confirmarse el pago.
              </p>
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

          {/* Resultado al volver de un pago */}
          {pagoResult === 'ok' && !valid && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-white font-medium">Recibimos tu pago</p>
                <p className="text-gray-400">Estamos esperando la confirmación del proveedor… se activa en segundos.</p>
              </div>
            </div>
          )}
          {pagoResult === 'fallo' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-white font-medium">El pago no se completó</p>
                <p className="text-gray-400">No se realizó ningún cargo. Podés intentarlo de nuevo.</p>
              </div>
            </div>
          )}

          {/* Medios de pago */}
          <div>
            <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">
              Medios de pago — 1 mes gratis ya incluido
            </p>

            <div className="space-y-3">
              {/* Mercado Pago */}
              <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                    MP
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold">Mercado Pago</p>
                    <p className="text-gray-400 text-xs">Pago automático — pesos argentinos</p>
                  </div>
                  <p className="text-white font-bold text-lg">$15.000 <span className="text-[10px] text-gray-500 font-normal">/mes</span></p>
                </div>
                <button
                  onClick={payWithMercadoPago}
                  disabled={payingMP}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {payingMP ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Iniciando…</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Pagar con Mercado Pago</>
                  )}
                </button>
              </div>

              {/* PayPal */}
              <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-yellow-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                    PP
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold">PayPal</p>
                    <p className="text-gray-400 text-xs">Pago automático — dólares</p>
                  </div>
                  <p className="text-white font-bold text-lg">US$10 <span className="text-[10px] text-gray-500 font-normal">/mes</span></p>
                </div>
                {PAYPAL_CLIENT_ID ? (
                  <div id="paypal-buttons" className="min-h-[50px]">
                    {!paypalReady && (
                      <div className="flex items-center justify-center gap-2 py-3 text-gray-500 text-xs">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-yellow-400 rounded-full animate-spin" />
                        Cargando PayPal…
                      </div>
                    )}
                  </div>
                ) : settings.paypal_link ? (
                  <a href={settings.paypal_link} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Pagar con PayPal
                  </a>
                ) : (
                  <p className="text-center text-gray-500 text-xs py-2">Pago con PayPal no disponible por el momento.</p>
                )}
              </div>
            </div>

            {/* Fallback manual */}
            <div className="mt-4 border-t border-gray-800 pt-3">
              <button
                onClick={handleDeclare}
                disabled={declaring}
                className="w-full flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {declaring ? 'Enviando…' : 'Ya pagué — reportar pago manualmente'}
              </button>
              <p className="text-[11px] text-gray-600 mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Solo como respaldo: te da 3 días de acceso hasta que el pago sea verificado por el administrador.
              </p>
            </div>
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
