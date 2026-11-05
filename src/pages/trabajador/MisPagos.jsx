import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function MisPagos() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadPayments(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('worker_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setPayments(data || []);
    } catch (e) {
      console.error('Error loading payments:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    const { error } = await supabase.rpc('confirm_worker_payment', { p_id: id });
    if (!error) {
      setPayments(payments.map(p =>
        p.id === id
          ? { ...p, status: 'confirmado', confirmed_at: new Date().toISOString() }
          : p
      ));
      showToast('Pago confirmado ✓');
    } else {
      showToast('No se pudo confirmar: ' + (error.message || ''));
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const pendientes = payments.filter(p => p.status !== 'confirmado').length;

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Mis Cobros</h1>
          <p className="text-gray-500 text-xs mt-1">
            {payments.length} pago{payments.length !== 1 ? 's' : ''} • Total: ${total.toLocaleString()}
            {pendientes > 0 && <span className="text-yellow-400"> • {pendientes} a confirmar</span>}
          </p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Cargando...</div>
        ) : payments.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No hay pagos registrados</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-[#0f1219] border border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm">{p.concept}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(p.created_at).toLocaleDateString('es-AR')} • {p.method}
                    {p.notes ? ` • ${p.notes}` : ''}
                  </p>
                  <p className="text-primary-400 font-bold text-lg mt-1">${Number(p.amount).toLocaleString()}</p>
                </div>

                {p.status === 'confirmado' ? (
                  <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                    Confirmado
                  </span>
                ) : (
                  <button
                    onClick={() => handleConfirm(p.id)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Clock className="w-4 h-4" />
                    Confirmar pago
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}