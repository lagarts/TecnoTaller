import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, CreditCard, Shield, Check, Save, ExternalLink,
  Clock, CheckCircle, XCircle, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isSubscriptionValid } from '../components/SubscriptionGate';

export default function Configuracion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [mpLink, setMpLink] = useState('');
  const [paypalLink, setPaypalLink] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        supabase.from('profiles')
          .select('subscription_plan, subscription_active, trial_ends_at')
          .eq('id', user.id)
          .single(),
        supabase.from('app_settings').select('key, value'),
      ]);
      if (!pRes.error && pRes.data) setProfile(pRes.data);
      if (!sRes.error) {
        const map = {};
        (sRes.data || []).forEach(r => { map[r.key] = r.value; });
        setMpLink(map.mp_link || '');
        setPaypalLink(map.paypal_link || '');
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  const saveLinks = async () => {
    setSavingLinks(true);
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'mp_link', value: mpLink.trim(), updated_at: new Date().toISOString() },
      { key: 'paypal_link', value: paypalLink.trim(), updated_at: new Date().toISOString() },
    ], { onConflict: 'key' });
    setSavingLinks(false);
    if (error) alert('Error al guardar: ' + error.message);
    else showToast('Links de pago guardados ✓');
  };

  const valid = isSubscriptionValid(profile);
  const accessUntil = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isLifetime = valid && !profile?.trial_ends_at && profile?.subscription_plan === 'pro';
  const daysLeft = accessUntil ? Math.ceil((accessUntil.getTime() - Date.now()) / 86400000) : null;
  const isTrial = valid && profile?.subscription_plan !== 'pro';

  const statusBadge = !profile ? null : isLifetime
    ? { text: 'Gratis x vida', cls: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle }
    : valid
    ? isTrial
      ? { text: `Prueba — ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`, cls: 'bg-blue-500/20 text-blue-300', icon: Clock }
      : { text: `Activa — ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`, cls: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle }
    : { text: 'Vencida', cls: 'bg-red-500/20 text-red-300', icon: Lock };

  const inputClass = "bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col overflow-y-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-400" />
          Configuración
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
        {/* General */}
        <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4.5 h-4.5 text-primary-400" style={{ width: 18, height: 18 }} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">General</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre del Taller</label>
              <input type="text" className={inputClass} defaultValue="TecnoTaller" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input type="email" className={inputClass} defaultValue="grafica.covac@hotmail.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Teléfono</label>
              <input type="tel" className={inputClass} defaultValue="+54 11 5555-0000" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Dirección</label>
              <input type="text" className={inputClass} defaultValue="Buenos Aires, Argentina" />
            </div>
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Suscripción */}
          <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Suscripción</h2>
              </div>
              {statusBadge && (
                <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge.cls}`}>
                  <statusBadge.icon className="w-3.5 h-3.5" />
                  {statusBadge.text}
                </span>
              )}
            </div>

            <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-4 text-white mb-3">
              <p className="text-xs opacity-80">Plan Actual</p>
              <p className="text-xl font-bold mt-1">TecnoTaller Mensual</p>
              <p className="text-xs opacity-80 mt-2">
                {accessUntil && !isLifetime
                  ? `Vigente hasta el ${accessUntil.toLocaleDateString('es-AR')}`
                  : isLifetime
                  ? 'Acceso de por vida'
                  : '1 mes gratis incluido'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0f1219] border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 bg-blue-500 rounded text-white text-[10px] font-bold flex items-center justify-center">MP</span>
                  <span className="text-xs font-bold text-blue-300">Mercado Pago</span>
                </div>
                <p className="text-white font-bold">$15.000 <span className="text-[10px] text-gray-500 font-normal">/mes</span></p>
              </div>
              <div className="bg-[#0f1219] border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 bg-yellow-500 rounded text-white text-[10px] font-bold flex items-center justify-center">PP</span>
                  <span className="text-xs font-bold text-yellow-300">PayPal</span>
                </div>
                <p className="text-white font-bold">US$10 <span className="text-[10px] text-gray-500 font-normal">/mes</span></p>
              </div>
            </div>

            <button
              onClick={() => navigate('/suscripcion')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              Ir a pagar / ver estado
            </button>

            {isAdmin && (
              <div className="border-t border-gray-700 pt-3 space-y-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Links de pago (solo admin)</p>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Link de pago Mercado Pago</label>
                  <input type="url" placeholder="https://www.mercadopago.com.ar/..." className={inputClass}
                    value={mpLink} onChange={e => setMpLink(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Link de pago PayPal</label>
                  <input type="url" placeholder="https://paypal.me/..." className={inputClass}
                    value={paypalLink} onChange={e => setPaypalLink(e.target.value)} />
                </div>
                <button onClick={saveLinks} disabled={savingLinks}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {savingLinks ? 'Guardando...' : 'Guardar links'}
                </button>
              </div>
            )}
          </div>

          {/* Seguridad */}
          <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-primary-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Seguridad</h2>
            </div>
            <div className="space-y-2">
              <button className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-[#0f1219] border border-gray-700 hover:border-gray-600 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">Cambiar contraseña</p>
                  <p className="text-xs text-gray-500">Actualizá tu contraseña</p>
                </div>
                <span className="text-gray-400">→</span>
              </button>
              <button className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-[#0f1219] border border-gray-700 hover:border-gray-600 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">Sesión activa</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <Check className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
