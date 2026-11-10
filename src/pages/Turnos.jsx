import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, ChevronLeft, ChevronRight, Plus, Check, X, Car,
  User, Phone, FileText, Wrench, Search, CheckCircle2, CircleDashed, XCircle,
  Link2, Copy
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const inputClass = "bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";
const labelClass = "block text-xs text-gray-400 mb-1";

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const STATUS_META = {
  pendiente: { label: 'Pendiente', icon: CircleDashed, cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  confirmado: { label: 'Confirmado', icon: CheckCircle2, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  cancelado: { label: 'Cancelado', icon: XCircle, cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  completado: { label: 'Completado', icon: Check, cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Turnos() {
  const [date, setDate] = useState(todayStr());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualSlot, setManualSlot] = useState(null); // hora para turno manual
  const [detail, setDetail] = useState(null);         // appointment seleccionado
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*, portal_clients(dni, name, phone), portal_vehicles(patente, brand, model, km)')
      .eq('appt_date', date)
      .order('appt_time');
    if (error) console.error('Error loading appointments:', error);
    setAppointments(data || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const shiftDate = (days) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  const byTime = {};
  appointments.forEach(a => { byTime[a.appt_time.slice(0, 5)] = a; });

  const pendingCount = appointments.filter(a => a.status === 'pendiente').length;
  const busyCount = appointments.filter(a => a.status === 'pendiente' || a.status === 'confirmado').length;
  const freeSlots = SLOTS.filter(s => !byTime[s] || byTime[s].status === 'cancelado' || byTime[s].status === 'completado');

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col overflow-y-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-400" />
          Turnos
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="bg-[#1a1f2e] border border-gray-700 hover:border-gray-500 text-gray-300 p-2 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
          <button onClick={() => shiftDate(1)} className="bg-[#1a1f2e] border border-gray-700 hover:border-gray-500 text-gray-300 p-2 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setDate(todayStr())} className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            Hoy
          </button>
        </div>
      </div>

      {/* Link del portal para clientes */}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(`${window.location.origin}/turnos`);
          showToast('Link copiado ✓ Pegalo donde quieras');
        }}
        className="mb-4 flex items-center justify-center gap-2 bg-[#1a1f2e] hover:bg-[#222839] border border-dashed border-primary-500/40 text-primary-300 hover:text-primary-200 py-2.5 rounded-xl text-xs font-medium transition-colors flex-shrink-0"
      >
        <Link2 className="w-4 h-4" />
        Copiar link del portal para que los clientes reserven
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-4 flex-shrink-0">
        <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-white font-bold text-lg">{busyCount}</p>
          <p className="text-[11px] text-gray-500">Turnos del día</p>
        </div>
        <div className="bg-[#1a1f2e] border border-yellow-500/30 rounded-xl p-3 text-center">
          <p className="text-yellow-300 font-bold text-lg">{pendingCount}</p>
          <p className="text-[11px] text-gray-500">Por confirmar</p>
        </div>
        <div className="bg-[#1a1f2e] border border-emerald-500/30 rounded-xl p-3 text-center">
          <p className="text-emerald-300 font-bold text-lg">{freeSlots.length}</p>
          <p className="text-[11px] text-gray-500">Espacios libres</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {SLOTS.map(slot => {
            const appt = byTime[slot];
            const isFree = !appt || appt.status === 'cancelado' || appt.status === 'completado';
            return (
              <div key={slot} className={`border rounded-xl p-3 flex items-center gap-3 ${
                isFree ? 'border-dashed border-gray-700 bg-transparent' : 'border-gray-700 bg-[#1a1f2e]'
              }`}>
                <div className="w-14 flex-shrink-0 text-center">
                  <p className={`font-bold text-sm ${isFree ? 'text-gray-600' : 'text-white'}`}>{slot}</p>
                </div>

                {isFree ? (
                  <button onClick={() => setManualSlot(slot)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm text-gray-600 hover:text-primary-400 hover:border-primary-500/50 border border-transparent transition-colors">
                    <Plus className="w-4 h-4" />
                    Espacio libre — registrar turno manual
                  </button>
                ) : (
                  <button onClick={() => setDetail(appt)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      appt.created_by === 'taller' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {appt.created_by === 'taller' ? <Wrench className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {appt.portal_clients?.name || appt.client_name || 'Cliente'}
                        <span className="text-gray-500 font-normal"> · {appt.portal_clients?.phone || appt.client_phone || ''}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {appt.portal_vehicles
                          ? `${appt.portal_vehicles.patente} — ${appt.portal_vehicles.brand} ${appt.portal_vehicles.model}`
                          : appt.patente || 'Sin vehículo'}
                        {appt.reason ? ` · ${appt.reason}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </button>
                )}
              </div>
            );
          })}

          {appointments.filter(a => !SLOTS.includes(a.appt_time.slice(0, 5))).length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-2">Fuera del horario habitual</p>
              <div className="space-y-2">
                {appointments.filter(a => !SLOTS.includes(a.appt_time.slice(0, 5))).map(a => (
                  <button key={a.id} onClick={() => setDetail(a)}
                    className="w-full border border-gray-700 bg-[#1a1f2e] rounded-xl p-3 flex items-center gap-3 text-left">
                    <div className="w-14 flex-shrink-0 text-center">
                      <p className="text-white font-bold text-sm">{a.appt_time.slice(0, 5)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {a.portal_clients?.name || a.client_name || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {a.portal_vehicles?.patente || a.patente || 'Sin vehículo'}
                        {a.reason ? ` · ${a.reason}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {manualSlot && (
        <ManualModal
          date={date}
          slot={manualSlot}
          onClose={() => setManualSlot(null)}
          onSaved={() => { setManualSlot(null); showToast('Turno registrado ✓'); load(); }}
        />
      )}
      {detail && (
        <DetailModal
          appt={detail}
          onClose={() => setDetail(null)}
          onChanged={(msg) => { setDetail(null); showToast(msg); load(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pendiente;
  const Icon = meta.icon;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${meta.cls}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ============================================================
// Registro manual por el mecánico
// ============================================================
function ManualModal({ date, slot, onClose, onSaved }) {
  const [mode, setMode] = useState('registrado'); // 'registrado' | 'sin_registrar'
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [client, setClient] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', patente: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchClients = async (q) => {
    setSearch(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('portal_clients')
      .select('id, dni, name, phone')
      .or(`name.ilike.%${q}%,dni.ilike.%${q}%`)
      .limit(8);
    setResults(data || []);
    setSearching(false);
  };

  const selectClient = async (c) => {
    setClient(c);
    setResults([]);
    setSearch(c.name || c.dni);
    const { data } = await supabase.from('portal_vehicles').select('*').eq('client_id', c.id).order('created_at');
    setVehicles(data || []);
    if (data && data.length > 0) setVehicleId(data[0].id);
  };

  const clearClient = () => {
    setClient(null);
    setSearch('');
    setVehicles([]);
    setVehicleId('');
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      appt_date: date,
      appt_time: slot + ':00',
      status: 'confirmado',
      created_by: 'taller',
      reason: form.reason.trim(),
    };
    if (mode === 'registrado' && client) {
      payload.client_id = client.id;
      payload.client_name = client.name || '';
      payload.client_phone = client.phone || '';
      if (vehicleId) {
        payload.vehicle_id = vehicleId;
        const v = vehicles.find(x => x.id === vehicleId);
        if (v) payload.patente = v.patente;
      }
    } else {
      if (!form.name.trim()) { setBusy(false); return; }
      payload.client_name = form.name.trim();
      payload.client_phone = form.phone.trim();
      payload.patente = form.patente.trim().toUpperCase();
    }

    const { error } = await supabase.from('appointments').insert(payload);
    setBusy(false);
    if (error) {
      if (error.code === '23505') alert('Ese horario ya está ocupado.');
      else alert('Error: ' + error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal onClose={onClose} title="Registrar turno manual">
      <div className="space-y-4">
        <div className="bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 flex items-center gap-2 text-sm text-gray-300">
          <Calendar className="w-4 h-4 text-primary-400" />
          {new Date(date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="text-gray-600">·</span>
          <Clock className="w-4 h-4 text-primary-400" />
          {slot}
        </div>

        {/* Modo cliente */}
        <div className="flex bg-[#0f1219] border border-gray-700 rounded-lg p-1">
          <button onClick={() => setMode('registrado')}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${mode === 'registrado' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Cliente registrado
          </button>
          <button onClick={() => setMode('sin_registrar')}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${mode === 'sin_registrar' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Cliente sin registrar
          </button>
        </div>

        {mode === 'registrado' ? (
          <div className="space-y-3">
            {!client ? (
              <div>
                <label className={labelClass}>Buscar por nombre o DNI</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" className={inputClass + ' pl-10'} placeholder="Juan o 30123456…"
                    value={search} onChange={e => searchClients(e.target.value)} />
                </div>
                {searching && <p className="text-[11px] text-gray-500 mt-1.5">Buscando…</p>}
                {results.length > 0 && (
                  <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    {results.map(r => (
                      <button key={r.id} onClick={() => selectClient(r)}
                        className="w-full text-left px-3 py-2.5 bg-[#1a1f2e] hover:bg-primary-600/20 border-b border-gray-700/50 last:border-0 transition-colors">
                        <p className="text-white text-sm">{r.name || 'Sin nombre'} <span className="text-gray-500">· DNI {r.dni}</span></p>
                        {r.phone && <p className="text-[11px] text-gray-500">{r.phone}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {search.trim().length >= 2 && !searching && results.length === 0 && (
                  <div className="mt-2 bg-[#0f1219] border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-sm">Sin resultados</p>
                    <p className="text-gray-600 text-[11px] mt-1">Usá "Cliente sin registrar" o pedile que se registre en el portal.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0f1219] border border-primary-500/40 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{client.name || 'Sin nombre'} · DNI {client.dni}</p>
                    {client.phone && <p className="text-[11px] text-gray-500">{client.phone}</p>}
                  </div>
                  <button onClick={clearClient} className="text-gray-500 hover:text-white text-xs flex-shrink-0">Cambiar</button>
                </div>
                {vehicles.length > 0 && (
                  <div className="mt-2">
                    <label className={labelClass}>Vehículo</label>
                    <select className={inputClass} value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.patente} — {v.brand} {v.model}</option>
                      ))}
                    </select>
                  </div>
                )}
                {vehicles.length === 0 && (
                  <p className="text-[11px] text-gray-500 mt-2">Este cliente no tiene vehículos cargados.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre del cliente *</label>
              <input type="text" className={inputClass} placeholder="Nombre y apellido"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Celular</label>
                <input type="tel" className={inputClass} placeholder="11 5555-0000"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Patente</label>
                <input type="text" className={inputClass} placeholder="ABC123"
                  value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Motivo de la visita</label>
          <input type="text" className={inputClass} placeholder="Revisión general, ruido al frenar…"
            value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={busy || (mode === 'registrado' && !client) || (mode === 'sin_registrar' && !form.name.trim())}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Registrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Detalle del turno + cambiar estado + registrar trabajo
// ============================================================
function DetailModal({ appt, onClose, onChanged, showToast }) {
  const [busy, setBusy] = useState(false);
  const [showService, setShowService] = useState(false);
  const [svc, setSvc] = useState({ description: '', km: '', price: '', notes: '' });

  const setStatus = async (status) => {
    setBusy(true);
    const { error } = await supabase.from('appointments').update({ status }).eq('id', appt.id);
    setBusy(false);
    if (error) { alert('Error: ' + error.message); return; }
    onChanged(`Turno ${STATUS_META[status].label.toLowerCase()} ✓`);
  };

  const registerService = async () => {
    if (!appt.vehicle_id) { alert('Esta reserva no tiene vehículo vinculado.'); return; }
    if (!svc.description.trim()) { alert('Ingresá la descripción del trabajo.'); return; }
    setBusy(true);
    const { error } = await supabase.from('service_records').insert({
      vehicle_id: appt.vehicle_id,
      origin: 'taller',
      service_date: new Date().toISOString().slice(0, 10),
      km: svc.km ? parseInt(svc.km) : null,
      description: svc.description.trim(),
      price: svc.price ? parseFloat(svc.price) : 0,
      notes: svc.notes.trim(),
    });
    setBusy(false);
    if (error) { alert('Error: ' + error.message); return; }
    // Al registrar trabajo, el turno queda completado
    await supabase.from('appointments').update({ status: 'completado' }).eq('id', appt.id);
    onChanged('Trabajo registrado y turno completado ✓');
  };

  const client = appt.portal_clients;
  const vehicle = appt.portal_vehicles;
  const name = client?.name || appt.client_name || 'Cliente';
  const phone = client?.phone || appt.client_phone || '';
  const vehText = vehicle
    ? `${vehicle.patente} — ${vehicle.brand} ${vehicle.model}`
    : appt.patente || 'Sin vehículo vinculado';

  return (
    <Modal onClose={onClose} title="Detalle del turno">
      <div className="space-y-4">
        <div className="bg-[#0f1219] border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Calendar className="w-4 h-4 text-primary-400" />
              {new Date(appt.appt_date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock className="w-4 h-4 text-primary-400" />
            {appt.appt_time.slice(0, 5)}
            <span className="text-gray-600 ml-2">
              {appt.created_by === 'taller' ? '· Registrado por el taller' : '· Reservado por el cliente'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white">
            <User className="w-4 h-4 text-primary-400" />
            {name} {phone && <span className="text-gray-500">· {phone}</span>}
            {client?.dni && <span className="text-gray-600">· DNI {client.dni}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Car className="w-4 h-4 text-primary-400" />
            {vehText}
            {vehicle?.km ? <span className="text-gray-600">· {Number(vehicle.km).toLocaleString()} km</span> : null}
          </div>
          {appt.reason && (
            <div className="flex items-start gap-2 text-sm text-gray-300">
              <FileText className="w-4 h-4 text-primary-400 mt-0.5" />
              {appt.reason}
            </div>
          )}
        </div>

        {/* Acciones de estado */}
        {appt.status === 'pendiente' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setStatus('confirmado')} disabled={busy}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Check className="w-4 h-4" /> Confirmar
            </button>
            <button onClick={() => setStatus('cancelado')} disabled={busy}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <X className="w-4 h-4" /> Rechazar
            </button>
          </div>
        )}
        {appt.status === 'confirmado' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowService(!showService)} disabled={busy}
              className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Wrench className="w-4 h-4" /> {showService ? 'Cerrar' : 'Registrar trabajo'}
            </button>
            <button onClick={() => setStatus('cancelado')} disabled={busy}
              className="flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>
        )}

        {/* Formulario de trabajo realizado */}
        {showService && (
          <div className="bg-[#0f1219] border border-primary-500/40 rounded-lg p-3 space-y-3">
            <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">Trabajo realizado</p>
            {!appt.vehicle_id && (
              <p className="text-[11px] text-yellow-400/80">Este turno no tiene vehículo vinculado, no se puede registrar el trabajo.</p>
            )}
            <div>
              <label className={labelClass}>Descripción *</label>
              <input type="text" className={inputClass} placeholder="Cambio de aceite y filtros…"
                value={svc.description} onChange={e => setSvc({ ...svc, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Kilometraje</label>
                <input type="number" className={inputClass} placeholder="85000"
                  value={svc.km} onChange={e => setSvc({ ...svc, km: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Precio</label>
                <input type="number" step="0.01" className={inputClass} placeholder="0"
                  value={svc.price} onChange={e => setSvc({ ...svc, price: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notas</label>
              <input type="text" className={inputClass} placeholder="Repuestos usados, etc."
                value={svc.notes} onChange={e => setSvc({ ...svc, notes: e.target.value })} />
            </div>
            <button onClick={registerService} disabled={busy || !appt.vehicle_id}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar trabajo y completar turno
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Modal base
// ============================================================
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
