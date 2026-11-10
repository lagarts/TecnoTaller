import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users, Bell, Trash2, Send, Shield, Gift,
  Calendar, Search, AlertTriangle, CheckCircle, X, CreditCard,
  Clock, Check, XCircle, Wallet, Database, Download, Upload,
  Car, FileText, Info, UserCheck
} from 'lucide-react';
import {
  buildPortalPayload, importPortalPayload, downloadJson,
  readFileText, parsePortabilityFile, fileSummary, PORTAL_FILE_TYPE
} from '../lib/portability';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notiTitle, setNotiTitle] = useState('');
  const [notiMessage, setNotiMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsuarios();
      fetchNotifications();
      fetchPayments();
    }
  }, [user]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsuarios(data || []);
    setLoading(false);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('subscription_payments')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    setPayments(data || []);
  };

  const handleApprovePayment = async (p) => {
    const who = p.profiles?.name || p.profiles?.email || 'usuario';
    if (!confirm(`¿Aprobar el pago de ${who} (${p.method === 'mercadopago' ? 'Mercado Pago' : 'PayPal'})?\nSe activará 1 mes de suscripción.`)) return;
    const { error } = await supabase.rpc('approve_subscription_payment', { p_id: p.id });
    if (error) { showToast('Error: ' + (error.message || 'error desconocido'), 'error'); return; }
    fetchPayments();
    showToast('Pago aprobado — suscripción activada por 1 mes');
  };

  const handleRejectPayment = async (p) => {
    const who = p.profiles?.name || p.profiles?.email || 'usuario';
    if (!confirm(`¿Rechazar el pago de ${who}?\nSe restaurará el acceso anterior (sin período de gracia).`)) return;
    const { error } = await supabase.rpc('reject_subscription_payment', { p_id: p.id });
    if (error) { showToast('Error: ' + (error.message || 'error desconocido'), 'error'); return; }
    fetchPayments();
    showToast('Pago rechazado');
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('¿Eliminar este usuario y todos sus datos?')) return;
    // Primero intenta borrar el usuario de auth (cascada borra el perfil)
    const { error } = await supabase.rpc('admin_delete_user', { target_id: userId });
    if (error) {
      // Fallback: borrar solo el perfil
      const { error: fallbackErr } = await supabase.from('profiles').delete().eq('id', userId);
      if (fallbackErr) {
        showToast('No se pudo eliminar: falta la función admin_delete_user en la BD', 'error');
        return;
      }
    }
    setUsuarios(usuarios.filter(u => u.id !== userId));
    showToast('Usuario eliminado');
  };

  const handleGrantLifetime = async (u) => {
    if (u.subscription_plan === 'pro') {
      if (!confirm('¿Quitar el acceso gratis de por vida?')) return;
      const updates = { subscription_plan: 'free', subscription_active: true };
      const { error } = await supabase.from('profiles').update(updates).eq('id', u.id);
      if (!error) {
        setUsuarios(usuarios.map(x => x.id === u.id ? { ...x, ...updates } : x));
        showToast('Acceso cambiado a Free');
      } else {
        showToast('No se pudo actualizar el usuario', 'error');
      }
      return;
    }

    if (!confirm(`¿Dar acceso GRATIS DE POR VIDA a ${u.name || u.email}?`)) return;
    const updates = {
      subscription_plan: 'pro',
      subscription_active: true,
      trial_ends_at: null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', u.id);
    if (!error) {
      setUsuarios(usuarios.map(x => x.id === u.id ? { ...x, ...updates } : x));
      showToast('Acceso gratis de por vida activado');
    } else {
      showToast('No se pudo actualizar el usuario', 'error');
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notiTitle.trim() || !notiMessage.trim()) return;
    setSending(true);
    const { error } = await supabase.from('notifications').insert({
      title: notiTitle.trim(),
      message: notiMessage.trim(),
      created_by: user.id,
    });
    setSending(false);
    if (!error) {
      setNotiTitle('');
      setNotiMessage('');
      fetchNotifications();
      showToast('Notificación enviada a todos los usuarios');
    } else {
      showToast('No se pudo enviar: ' + (error.message || 'error desconocido'), 'error');
    }
  };

  const handleDeleteNotification = async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(notifications.filter(n => n.id !== id));
  };

  // --------------------------------------------------------
  // Portabilidad de datos (exportar / importar el portal)
  // --------------------------------------------------------
  const handleExportPortal = async () => {
    setExporting(true);
    try {
      const [cRes, vRes, rRes, aRes] = await Promise.all([
        supabase.from('portal_clients').select('*'),
        supabase.from('portal_vehicles').select('*'),
        supabase.from('service_records').select('*'),
        supabase.from('appointments').select('*'),
      ]);
      const err = cRes.error || vRes.error || rRes.error || aRes.error;
      if (err) { showToast('No se pudo exportar: ' + err.message, 'error'); return; }
      const payload = buildPortalPayload({
        clients: cRes.data || [],
        vehicles: vRes.data || [],
        records: rRes.data || [],
        appointments: aRes.data || [],
      });
      downloadJson(`tecnotaller-portal-${new Date().toISOString().slice(0, 10)}.json`, payload);
      showToast(`Portal exportado ✓ (${payload.data.clients.length} clientes, ${payload.data.vehicles.length} vehículos)`);
    } catch (e) {
      console.error(e);
      showToast('No se pudo generar el archivo', 'error');
    }
    setExporting(false);
  };

  const handleImportFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setImporting(true);
    try {
      const text = await readFileText(f);
      const { file, error } = parsePortabilityFile(text);
      if (error) { showToast(error, 'error'); return; }
      if (file.type !== PORTAL_FILE_TYPE) {
        showToast('Ese archivo es de un cliente. Usá "Importar respaldo del portal" con el archivo del taller.', 'error');
        return;
      }
      const s = fileSummary(file);
      const ok = confirm(
        `¿Importar "${f.name}"?\n\n` +
        `Clientes: ${s.clients} • Vehículos: ${s.vehicles} • Servicios: ${s.records} • Turnos: ${s.appointments}\n\n` +
        'Los clientes que todavía no tengan cuenta quedarán como pendientes (se importan cuando se registren). ' +
        'El proceso se puede repetir sin duplicar datos.\n\n¿Continuar?'
      );
      if (!ok) return;
      const res = await importPortalPayload(file, { client: supabase });
      if (res.error) { showToast(res.error, 'error'); return; }
      setImportResult(res);
      showToast('Importación finalizada ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo leer el archivo', 'error');
    }
    setImporting(false);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="h-full min-h-[60vh] flex items-center justify-center bg-[#0f1219]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Acceso Denegado</h2>
          <p className="text-gray-400 mt-2">Solo los administradores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  const filteredUsuarios = usuarios.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-400" />
            Panel de Administración
          </h1>
          <p className="text-gray-500 text-xs mt-1">Gestiona usuarios y notificaciones</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-shrink-0 border-b border-gray-700/50">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'usuarios'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuarios ({usuarios.length})
        </button>
        <button
          onClick={() => setActiveTab('notificaciones')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'notificaciones'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Bell className="w-4 h-4" />
          Notificaciones
        </button>
        <button
          onClick={() => setActiveTab('suscripcion')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'suscripcion'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Suscripción
          {payments.filter(p => p.status === 'pendiente').length > 0 && (
            <span className="bg-yellow-500/20 text-yellow-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {payments.filter(p => p.status === 'pendiente').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('datos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'datos'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Database className="w-4 h-4" />
          Datos
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'usuarios' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#1a1f2e] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Cargando usuarios...</div>
            ) : (
              <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#151a26]">
                      <tr className="text-gray-400 text-left text-xs uppercase">
                        <th className="px-4 py-3 font-medium">Usuario</th>
                        <th className="px-4 py-3 font-medium">Rol</th>
                        <th className="px-4 py-3 font-medium">Plan</th>
                        <th className="px-4 py-3 font-medium">Registro</th>
                        <th className="px-4 py-3 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsuarios.map((u) => (
                        <tr key={u.id} className="border-t border-gray-700/30 text-gray-300 hover:bg-[#1e2433]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm">
                                {u.name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <p className="font-medium text-white">{u.name}</p>
                                <p className="text-xs text-gray-500">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              u.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300'
                                : u.role === 'worker'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-gray-600/30 text-gray-300'
                            }`}>
                              {u.role === 'admin' && <Shield className="w-3 h-3" />}
                              {u.role === 'admin' ? 'Admin' : u.role === 'worker' ? 'Worker' : 'Usuario'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              u.subscription_plan === 'pro'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {u.subscription_plan === 'pro' ? 'Gratis x vida ✓' : 'Free'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(u.created_at).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleGrantLifetime(u)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  u.subscription_plan === 'pro'
                                    ? 'bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25'
                                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                }`}
                                title={u.subscription_plan === 'pro' ? 'Quitar acceso' : 'Dar gratis de por vida'}
                              >
                                <Gift className="w-3.5 h-3.5" />
                                {u.subscription_plan === 'pro' ? 'Quitar' : 'Gratis x vida'}
                              </button>
                              {u.role !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredUsuarios.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No se encontraron usuarios</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notificaciones' && (
          <div className="space-y-6">
            <form onSubmit={handleSendNotification} className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Send className="w-4 h-4 text-primary-400" />
                Enviar notificación a todos los usuarios
              </h3>
              <input
                type="text"
                placeholder="Título de la notificación"
                value={notiTitle}
                onChange={(e) => setNotiTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f1219] border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                required
              />
              <textarea
                placeholder="Escribí el mensaje de la notificación..."
                value={notiMessage}
                onChange={(e) => setNotiMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-[#0f1219] border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
                required
              />
              <button
                type="submit"
                disabled={sending || !notiTitle.trim() || !notiMessage.trim()}
                className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Enviar notificación'}
              </button>
            </form>

            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50">
                <h3 className="font-semibold text-white text-sm">Notificaciones enviadas</h3>
              </div>
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay notificaciones enviadas</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 hover:bg-[#1e2433] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">{n.title}</p>
                          <p className="text-gray-400 text-sm mt-1">{n.message}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(n.created_at).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteNotification(n.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'suscripcion' && (
          <div className="space-y-6">
            {/* Pagos pendientes */}
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-white text-sm">
                  Pagos por verificar ({payments.filter(p => p.status === 'pendiente').length})
                </h3>
              </div>
              {payments.filter(p => p.status === 'pendiente').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay pagos pendientes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {payments.filter(p => p.status === 'pendiente').map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                          p.method === 'mercadopago' ? 'bg-blue-500' : 'bg-yellow-500'
                        }`}>
                          {p.method === 'mercadopago' ? 'MP' : 'PP'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {p.profiles?.name || p.profiles?.email || 'Usuario eliminado'}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {p.method === 'mercadopago' ? 'Mercado Pago' : 'PayPal'} •{' '}
                            {p.currency === 'USD' ? `US$${Number(p.amount)}` : `$${Number(p.amount).toLocaleString()}`} •{' '}
                            {new Date(p.created_at).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprovePayment(p)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectPayment(p)}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial */}
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary-400" />
                <h3 className="font-semibold text-white text-sm">Historial de pagos</h3>
              </div>
              {payments.filter(p => p.status !== 'pendiente').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin pagos registrados todavía</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {payments.filter(p => p.status !== 'pendiente').map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {p.profiles?.name || p.profiles?.email || 'Usuario eliminado'} —{' '}
                          {p.currency === 'USD' ? `US$${Number(p.amount)}` : `$${Number(p.amount).toLocaleString()}`}
                          <span className="text-gray-500 font-normal"> ({p.method === 'mercadopago' ? 'MP' : 'PayPal'})</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Declarado: {new Date(p.created_at).toLocaleString('es-AR')}
                          {p.reviewed_at && ` • Revisado: ${new Date(p.reviewed_at).toLocaleString('es-AR')}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase flex items-center gap-1 flex-shrink-0 ${
                        p.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {p.status === 'aprobado' ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'datos' && (
          <div className="space-y-6 max-w-3xl">
            {/* Explicación */}
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Portabilidad de datos del portal de turnos: clientes, vehículos, turnos e historial de servicios.
                <span className="text-gray-500"> Las contraseñas nunca se guardan en el archivo</span> — si el
                archivo se importa en otra instancia, los clientes se registran de nuevo con su DNI y los datos
                se les asocian automáticamente al importar.
              </p>
            </div>

            {/* Exportar */}
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Exportar todo el portal</h3>
              </div>
              <p className="text-xs text-gray-400">
                Descarga un respaldo con todos los clientes del portal, sus vehículos, los turnos y el historial
                de servicios. Guardalo en un lugar seguro.
              </p>
              <button
                onClick={handleExportPortal}
                disabled={exporting || importing}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {exporting
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Download className="w-4 h-4" />}
                {exporting ? 'Exportando…' : 'Descargar respaldo JSON'}
              </button>
            </div>

            {/* Importar */}
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary-400" />
                <h3 className="font-semibold text-white text-sm">Importar respaldo del portal</h3>
              </div>
              <p className="text-xs text-gray-400">
                Carga un archivo exportado desde acá (o un respaldo individual de un cliente). Es seguro repetirlo:
                lo que ya exista no se duplica.
              </p>
              <label className={`inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Upload className="w-4 h-4" />}
                {importing ? 'Importando…' : 'Elegir archivo…'}
                <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} disabled={importing} />
              </label>
            </div>

            {/* Resultado de la importación */}
            {importResult && (
              <div className="bg-[#1a1f2e] border border-emerald-500/40 rounded-xl p-5 space-y-4">
                <p className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Importación finalizada
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <AdminStat label="Clientes listos" value={importResult.clientes} />
                  <AdminStat label="Vehículos nuevos" value={importResult.vehiculos} />
                  <AdminStat label="Servicios importados" value={importResult.servicios} />
                  <AdminStat label="Turnos importados" value={importResult.turnos} />
                </div>

                {(importResult.vehiculosExistentes > 0 || importResult.serviciosDuplicados > 0 || importResult.vehiculosOmitidos > 0 || importResult.serviciosOmitidos > 0 || importResult.turnosOmitidos > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <AdminStat label="Vehículos ya existentes" value={importResult.vehiculosExistentes} muted />
                    <AdminStat label="Servicios duplicados" value={importResult.serviciosDuplicados} muted />
                    <AdminStat label="Sin importar (veh/serv)" value={importResult.vehiculosOmitidos + importResult.serviciosOmitidos} muted warn={(importResult.vehiculosOmitidos + importResult.serviciosOmitidos) > 0} />
                    <AdminStat label="Turnos omitidos" value={importResult.turnosOmitidos} muted warn={importResult.turnosOmitidos > 0} />
                  </div>
                )}

                {importResult.clientesPendientes.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      {importResult.clientesPendientes.length} cliente(s) sin cuenta todavía
                    </p>
                    <p className="text-[11px] text-yellow-200/70">
                      Pasales el link <span className="text-yellow-200">/turnos</span> para que se registren con su DNI
                      y después volvé a importar el mismo archivo: sus datos se completan solos, sin duplicar nada.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {importResult.clientesPendientes.map((c) => (
                        <span key={c.dni} className="bg-[#0f1219] border border-yellow-500/20 text-gray-300 text-[11px] px-2 py-1 rounded">
                          DNI {c.dni}{c.name ? ` · ${c.name}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.avisos.length > 0 && (
                  <div className="space-y-1">
                    {importResult.avisos.map((a, i) => (
                      <p key={i} className="text-[11px] text-gray-400 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-500" />
                        {a}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setImportResult(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminStat({ label, value, muted, warn }) {
  return (
    <div className={`bg-[#0f1219] border rounded-lg px-3 py-2.5 ${warn ? 'border-yellow-500/40' : muted ? 'border-gray-700/50' : 'border-gray-700'}`}>
      <p className={`font-bold text-base ${warn ? 'text-yellow-300' : muted ? 'text-gray-300' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
    </div>
  );
}