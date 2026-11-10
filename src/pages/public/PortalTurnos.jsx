import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Car, FileText, LogOut, Plus, Wrench, ShieldCheck,
  User, Phone, CreditCard, Check, X, Trash2, Edit3, ChevronRight, AlertCircle
} from 'lucide-react';
import { portalClient, portalRegister, portalLogin, portalLogout } from '../../lib/portal';

const inputClass = "bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";
const labelClass = "block text-xs text-gray-400 mb-1";

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const STATUS_META = {
  pendiente: { label: 'Pendiente', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  confirmado: { label: 'Confirmado', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  completado: { label: 'Completado', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

export default function PortalClienteTurnos() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('turnos');
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProfile = useCallback(async (userId) => {
    const { data } = await portalClient
      .from('portal_clients')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    portalClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = portalClient.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const handleLogout = async () => {
    await portalLogout();
    setTab('turnos');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1219] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onDone={(user) => { setSession({ user }); loadProfile(user.id); }} showToast={showToast} />;
  }

  const tabs = [
    { id: 'turnos', label: 'Turnos', icon: Calendar },
    { id: 'vehiculos', label: 'Mis vehículos', icon: Car },
    { id: 'historial', label: 'Historial', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#0f1219] flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logopwa.ico" alt="TecnoTaller" className="w-8 h-8 rounded-lg object-cover" />
          <div>
            <p className="font-bold text-white text-sm leading-tight">
              <span className="text-blue-400">Tecno</span>Taller
            </p>
            <p className="text-[10px] text-gray-500">Portal del cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white font-medium">{profile?.name || 'Cliente'}</p>
            <p className="text-[10px] text-gray-500">DNI {profile?.dni}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'turnos' && <TurnosTab profile={profile} showToast={showToast} />}
        {tab === 'vehiculos' && <VehiculosTab profile={profile} showToast={showToast} />}
        {tab === 'historial' && <HistorialTab profile={profile} showToast={showToast} />}
      </div>
    </div>
  );
}

// ============================================================
// AUTH: registro e ingreso con DNI + contraseña
// ============================================================
function AuthScreen({ onDone, showToast }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ dni: '', name: '', phone: '', password: '', repeat: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const dni = form.dni.replace(/\D/g, '');
    if (dni.length < 7) { setError('Ingresá un DNI válido (mínimo 7 números)'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

    setBusy(true);
    try {
      if (mode === 'register') {
        if (!form.name.trim()) { setError('Ingresá tu nombre y apellido'); setBusy(false); return; }
        if (form.password !== form.repeat) { setError('Las contraseñas no coinciden'); setBusy(false); return; }
        const res = await portalRegister({ dni, name: form.name.trim(), phone: form.phone.trim(), password: form.password });
        if (res.error) { setError(res.error); return; }
        showToast('¡Cuenta creada! Bienvenido/a ✓');
        onDone(res.user);
      } else {
        const res = await portalLogin({ dni, password: form.password });
        if (res.error) { setError(res.error); return; }
        onDone(res.user);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión. Intentá de nuevo.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1219] flex flex-col">
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-2.5">
        <img src="/logopwa.ico" alt="TecnoTaller" className="w-8 h-8 rounded-lg object-cover" />
        <span className="font-bold text-white">
          <span className="text-blue-400">Tecno</span>Taller
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl p-6 max-w-md w-full">
          <div className="text-center mb-6">
            <ShieldCheck className="w-10 h-10 text-primary-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white">
              {mode === 'login' ? 'Ingresá a tu cuenta' : 'Creá tu cuenta'}
            </h1>
            <p className="text-gray-400 text-xs mt-1.5">
              {mode === 'login'
                ? 'Con tu DNI y contraseña'
                : 'Solo necesitás tu DNI y una contraseña'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2.5 rounded-lg mb-4 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Toggle */}
          <div className="flex bg-[#0f1219] border border-gray-700 rounded-lg p-1 mb-5">
            <button onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Ingresar
            </button>
            <button onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'register' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Registrarme
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass}>DNI</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" inputMode="numeric" className={inputClass + ' pl-10'} placeholder="30123456"
                  value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className={labelClass}>Nombre y apellido</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" className={inputClass + ' pl-10'} placeholder="Tu nombre..." value={form.name} onChange={set('name')} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Celular (opcional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="tel" className={inputClass + ' pl-10'} placeholder="11 5555-0000" value={form.phone} onChange={set('phone')} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Contraseña</label>
              <input type="password" className={inputClass} placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} />
            </div>

            {mode === 'register' && (
              <div>
                <label className={labelClass}>Repetir contraseña</label>
                <input type="password" className={inputClass} placeholder="Otra vez tu contraseña" value={form.repeat} onChange={set('repeat')} />
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procesando…</>
              ) : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-[11px] text-gray-600 text-center mt-5">
            Tus datos son privados. Solo vos y tu mecánico ven tu información.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TURNOS: reservar + mis reservas
// ============================================================
function TurnosTab({ profile, showToast }) {
  const [appointments, setAppointments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', date: '', time: '', reason: '' });
  const [takenSlots, setTakenSlots] = useState([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const [apptRes, vehRes] = await Promise.all([
      portalClient.from('appointments')
        .select('*, portal_vehicles(patente, brand, model)')
        .order('appt_date', { ascending: false })
        .order('appt_time', { ascending: false }),
      portalClient.from('portal_vehicles').select('*').order('created_at'),
    ]);
    setAppointments(apptRes.data || []);
    setVehicles(vehRes.data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Horarios ocupados de la fecha elegida
  useEffect(() => {
    if (!form.date) { setTakenSlots([]); return; }
    let cancel = false;
    portalClient.from('appointments')
      .select('appt_time, status')
      .eq('appt_date', form.date)
      .in('status', ['pendiente', 'confirmado'])
      .then(({ data }) => {
        if (!cancel) setTakenSlots((data || []).map(a => a.appt_time.slice(0, 5)));
      });
    return () => { cancel = true; };
  }, [form.date]);

  const today = new Date().toISOString().slice(0, 10);

  const handleBook = async () => {
    if (!form.vehicle_id || !form.date || !form.time) {
      showToast('Elegí vehículo, fecha y horario', false);
      return;
    }
    setBooking(true);
    const { error } = await portalClient.from('appointments').insert({
      client_id: profile.id,
      vehicle_id: form.vehicle_id,
      appt_date: form.date,
      appt_time: form.time,
      reason: form.reason.trim(),
      status: 'pendiente',
      created_by: 'cliente',
    });
    setBooking(false);
    if (error) {
      if (error.code === '23505') showToast('Ese horario ya está reservado, elegí otro', false);
      else showToast('No se pudo reservar: ' + error.message, false);
      return;
    }
    showToast('Turno reservado ✓ El taller lo va a confirmar');
    setForm({ vehicle_id: '', date: '', time: '', reason: '' });
    load();
  };

  const handleCancel = async (appt) => {
    if (!confirm('¿Cancelar este turno?')) return;
    const { error } = await portalClient.from('appointments')
      .update({ status: 'cancelado' })
      .eq('id', appt.id);
    if (error) { showToast('No se pudo cancelar', false); return; }
    showToast('Turno cancelado');
    load();
  };

  if (loading) return <Spinner />;

  const upcoming = appointments.filter(a => a.appt_date >= today && (a.status === 'pendiente' || a.status === 'confirmado'));
  const past = appointments.filter(a => !(a.appt_date >= today && (a.status === 'pendiente' || a.status === 'confirmado')));

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Reservar */}
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Reservar turno</h2>
        </div>

        {vehicles.length === 0 ? (
          <div className="text-center py-5">
            <Car className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">Primero agregá tu vehículo</p>
            <p className="text-gray-600 text-xs">Andá a la pestaña "Mis vehículos" para registrarlo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Vehículo *</label>
              <select className={inputClass} value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
                <option value="">Elegí tu vehículo…</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.patente} — {v.brand} {v.model}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fecha *</label>
                <input type="date" min={today} className={inputClass} value={form.date} onChange={e => setForm({ ...form, date: e.target.value, time: '' })} />
              </div>
              <div>
                <label className={labelClass}>Problema (opcional)</label>
                <input type="text" className={inputClass} placeholder="Ruido al frenar…" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>

            {form.date && (
              <div>
                <label className={labelClass}>Horarios disponibles *</label>
                <div className="grid grid-cols-3 gap-2">
                  {SLOTS.map(s => {
                    const taken = takenSlots.includes(s);
                    const sel = form.time === s;
                    return (
                      <button key={s} disabled={taken} onClick={() => setForm({ ...form, time: s })}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors border ${
                          taken
                            ? 'bg-gray-800/50 border-gray-700 text-gray-600 line-through cursor-not-allowed'
                            : sel
                              ? 'bg-primary-600 border-primary-500 text-white'
                              : 'bg-[#0f1219] border-gray-700 text-gray-300 hover:border-primary-500'
                        }`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-600 mt-2">Los tachados ya están ocupados.</p>
              </div>
            )}

            <button onClick={handleBook} disabled={booking || !form.vehicle_id || !form.date || !form.time}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {booking ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Reservar turno
            </button>
          </div>
        )}
      </div>

      {/* Próximos */}
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mis próximos turnos</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No tenés turnos reservados</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(a => <ApptCard key={a.id} a={a} onCancel={handleCancel} />)}
          </div>
        )}
      </div>

      {/* Historial de turnos */}
      {past.length > 0 && (
        <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Turnos anteriores</h2>
          <div className="space-y-2">
            {past.map(a => <ApptCard key={a.id} a={a} onCancel={handleCancel} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ApptCard({ a, onCancel }) {
  const meta = STATUS_META[a.status] || STATUS_META.pendiente;
  const canCancel = a.status === 'pendiente' || a.status === 'confirmado';
  return (
    <div className="bg-[#0f1219] border border-gray-700 rounded-lg p-3 flex items-center gap-3">
      <div className="w-12 text-center flex-shrink-0">
        <p className="text-white font-bold text-sm">{a.appt_time.slice(0, 5)}</p>
        <p className="text-[10px] text-gray-500">{new Date(a.appt_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {a.portal_vehicles ? `${a.portal_vehicles.patente} — ${a.portal_vehicles.brand} ${a.portal_vehicles.model}` : 'Vehículo'}
        </p>
        {a.reason && <p className="text-[11px] text-gray-500 truncate">{a.reason}</p>}
        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
      </div>
      {canCancel && (
        <button onClick={() => onCancel(a)} className="text-gray-500 hover:text-red-400 p-1.5 flex-shrink-0" title="Cancelar turno">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// VEHÍCULOS
// ============================================================
function VehiculosTab({ profile, showToast }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState({ patente: '', brand: '', model: '', year: '', color: '', km: '', notes: '' });

  const load = useCallback(async () => {
    const { data } = await portalClient.from('portal_vehicles').select('*').order('created_at');
    setVehicles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const startNew = () => {
    setForm({ patente: '', brand: '', model: '', year: '', color: '', km: '', notes: '' });
    setEditing('new');
  };

  const startEdit = (v) => {
    setForm({
      patente: v.patente || '', brand: v.brand || '', model: v.model || '',
      year: v.year || '', color: v.color || '', km: v.km ?? '', notes: v.notes || '',
    });
    setEditing(v.id);
  };

  const save = async () => {
    if (!form.patente.trim() || !form.brand.trim() || !form.model.trim()) {
      showToast('Patente, marca y modelo son obligatorios', false);
      return;
    }
    const payload = {
      client_id: profile.id,
      patente: form.patente.trim().toUpperCase(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year ? parseInt(form.year) : null,
      color: form.color.trim(),
      km: form.km ? parseInt(form.km) : 0,
      notes: form.notes.trim(),
    };
    let error;
    if (editing === 'new') {
      ({ error } = await portalClient.from('portal_vehicles').insert(payload));
    } else {
      delete payload.client_id;
      ({ error } = await portalClient.from('portal_vehicles').update(payload).eq('id', editing));
    }
    if (error) {
      if (error.code === '23505') showToast('Ya existe un vehículo con esa patente', false);
      else showToast('Error: ' + error.message, false);
      return;
    }
    showToast(editing === 'new' ? 'Vehículo agregado ✓' : 'Vehículo actualizado ✓');
    setEditing(null);
    load();
  };

  const remove = async (v) => {
    if (!confirm(`¿Eliminar ${v.patente}?\n\nSe borrará también su historial de servicios.`)) return;
    const { error } = await portalClient.from('portal_vehicles').delete().eq('id', v.id);
    if (error) { showToast('No se pudo eliminar', false); return; }
    showToast('Vehículo eliminado');
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-primary-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mis vehículos</h2>
        </div>
        {editing === null && (
          <button onClick={startNew} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="bg-[#1a1f2e] border border-primary-500/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">
            {editing === 'new' ? 'Nuevo vehículo' : 'Editar vehículo'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Patente *</label>
              <input type="text" className={inputClass} placeholder="ABC123" value={form.patente}
                onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className={labelClass}>Año</label>
              <input type="number" className={inputClass} placeholder="2020" value={form.year} onChange={set('year')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Marca *</label>
              <input type="text" className={inputClass} placeholder="Ford" value={form.brand} onChange={set('brand')} />
            </div>
            <div>
              <label className={labelClass}>Modelo *</label>
              <input type="text" className={inputClass} placeholder="Fiesta" value={form.model} onChange={set('model')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Color</label>
              <input type="text" className={inputClass} placeholder="Blanco" value={form.color} onChange={set('color')} />
            </div>
            <div>
              <label className={labelClass}>Kilometraje</label>
              <input type="number" className={inputClass} placeholder="85000" value={form.km} onChange={set('km')} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <input type="text" className={inputClass} placeholder="Detalles adicionales…" value={form.notes} onChange={set('notes')} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={save} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Guardar
            </button>
          </div>
        </div>
      )}

      {vehicles.length === 0 && editing === null && (
        <div className="text-center py-10">
          <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Todavía no tenés vehículos registrados</p>
        </div>
      )}

      {vehicles.map(v => (
        <div key={v.id} className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold">{v.patente}</p>
              <p className="text-gray-400 text-sm">{v.brand} {v.model} {v.year ? `· ${v.year}` : ''}</p>
              <p className="text-gray-600 text-xs mt-0.5">
                {v.color ? `${v.color} · ` : ''}{v.km ? `${Number(v.km).toLocaleString()} km` : 'km sin registrar'}
              </p>
              {v.notes && <p className="text-gray-600 text-xs mt-0.5">{v.notes}</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => startEdit(v)} className="text-gray-500 hover:text-primary-400 p-1.5" title="Editar">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => remove(v)} className="text-gray-500 hover:text-red-400 p-1.5" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// HISTORIAL: trabajo del taller + servicios de otros lugares
// ============================================================
function HistorialTab({ profile, showToast }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ service_date: '', km: '', description: '', price: '', notes: '' });

  const loadVehicles = useCallback(async () => {
    const { data } = await portalClient.from('portal_vehicles').select('*').order('created_at');
    setVehicles(data || []);
    if (data && data.length > 0 && !vehicleId) setVehicleId(data[0].id);
    setLoading(false);
  }, [vehicleId]);

  const loadRecords = useCallback(async () => {
    if (!vehicleId) { setRecords([]); return; }
    const { data } = await portalClient.from('service_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false });
    setRecords(data || []);
  }, [vehicleId]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const startAdd = () => {
    setForm({ service_date: new Date().toISOString().slice(0, 10), km: '', description: '', price: '', notes: '' });
    setEditingId(null);
    setAdding(true);
  };

  const startEdit = (r) => {
    setForm({
      service_date: r.service_date || '', km: r.km ?? '', description: r.description || '',
      price: r.price ?? '', notes: r.notes || '',
    });
    setEditingId(r.id);
    setAdding(true);
  };

  const save = async () => {
    if (!form.description.trim() || !form.service_date) {
      showToast('Fecha y descripción son obligatorias', false);
      return;
    }
    const payload = {
      vehicle_id: vehicleId,
      origin: 'externo',
      service_date: form.service_date,
      km: form.km ? parseInt(form.km) : null,
      description: form.description.trim(),
      price: form.price ? parseFloat(form.price) : 0,
      notes: form.notes.trim(),
      created_by: profile.id,
    };
    let error;
    if (editingId) {
      delete payload.vehicle_id;
      delete payload.created_by;
      delete payload.origin;
      ({ error } = await portalClient.from('service_records').update(payload).eq('id', editingId));
    } else {
      ({ error } = await portalClient.from('service_records').insert(payload));
    }
    if (error) { showToast('Error: ' + error.message, false); return; }
    showToast(editingId ? 'Servicio actualizado ✓' : 'Servicio agregado ✓');
    setAdding(false);
    setEditingId(null);
    loadRecords();
  };

  const remove = async (r) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const { error } = await portalClient.from('service_records').delete().eq('id', r.id);
    if (error) { showToast('No se pudo eliminar', false); return; }
    showToast('Registro eliminado');
    loadRecords();
  };

  if (loading) return <Spinner />;

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 max-w-lg mx-auto">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Primero registrá un vehículo para ver su historial.</p>
      </div>
    );
  }

  const taller = records.filter(r => r.origin === 'taller');
  const externo = records.filter(r => r.origin === 'externo');

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historial del vehículo</h2>
      </div>

      {/* Selector de vehículo */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {vehicles.map(v => (
          <button key={v.id} onClick={() => { setVehicleId(v.id); setAdding(false); }}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
              vehicleId === v.id
                ? 'bg-primary-600 border-primary-500 text-white'
                : 'bg-[#1a1f2e] border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {v.patente}
          </button>
        ))}
      </div>

      {/* Formulario agregar/editar servicio externo */}
      {adding && (
        <div className="bg-[#1a1f2e] border border-primary-500/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">
            {editingId ? 'Editar servicio' : 'Agregar servicio hecho en otro lugar'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha *</label>
              <input type="date" className={inputClass} value={form.service_date} onChange={set('service_date')} />
            </div>
            <div>
              <label className={labelClass}>Kilometraje</label>
              <input type="number" className={inputClass} placeholder="85000" value={form.km} onChange={set('km')} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Descripción del servicio *</label>
            <input type="text" className={inputClass} placeholder="Cambio de cubiertas…" value={form.description} onChange={set('description')} />
          </div>
          <div>
            <label className={labelClass}>Precio pagado</label>
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.price} onChange={set('price')} />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <input type="text" className={inputClass} placeholder="Marca de cubiertas, etc." value={form.notes} onChange={set('notes')} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setEditingId(null); }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={save} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Guardar
            </button>
          </div>
        </div>
      )}

      {!adding && (
        <button onClick={startAdd} className="w-full flex items-center justify-center gap-2 bg-[#1a1f2e] hover:bg-[#222839] border border-dashed border-gray-600 text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Agregar servicio hecho en otro lugar
        </button>
      )}

      {/* Trabajo del taller */}
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider">Trabajo realizado en el taller</h3>
        </div>
        {taller.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-3">Sin registros todavía</p>
        ) : (
          <div className="space-y-2">
            {taller.map(r => <RecordCard key={r.id} r={r} canEdit={false} onEdit={() => {}} onRemove={() => {}} />)}
          </div>
        )}
      </div>

      {/* Servicios externos */}
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Car className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Servicios en otros lugares</h3>
        </div>
        {externo.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-3">No agregaste servicios externos</p>
        ) : (
          <div className="space-y-2">
            {externo.map(r => (
              <RecordCard key={r.id} r={r} canEdit onEdit={() => startEdit(r)} onRemove={() => remove(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordCard({ r, canEdit, onEdit, onRemove }) {
  return (
    <div className="bg-[#0f1219] border border-gray-700 rounded-lg p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{r.description}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {new Date(r.service_date + 'T00:00:00').toLocaleDateString('es-AR')}
          {r.km ? ` · ${Number(r.km).toLocaleString()} km` : ''}
          {Number(r.price) > 0 ? ` · $${Number(r.price).toLocaleString()}` : ''}
        </p>
        {r.notes && <p className="text-[11px] text-gray-600 mt-0.5">{r.notes}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="text-gray-500 hover:text-primary-400 p-1.5" title="Editar">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="text-gray-500 hover:text-red-400 p-1.5" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>
  );
}
