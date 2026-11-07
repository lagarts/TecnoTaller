import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Wallet, X, ArrowUpRight, ArrowDownRight, Eye,
  Trash2, Users, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const METHODS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

export default function CuentaCorrientes() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'cargo' | 'pago' | 'cliente'
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [cargoForm, setCargoForm] = useState({ client_id: '', description: '', amount: '', notes: '' });
  const [pagoForm, setPagoForm] = useState({ client_id: '', amount: '', method: 'efectivo', notes: '' });
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' });

  const inputClass = "bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        supabase.from('account_movements')
          .select('*, clients(id, name, phone)')
          .order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, phone').order('name'),
      ]);
      const movs = mRes.data || [];
      setMovements(movs);
      setClients(cRes.data || []);

      const map = {};
      movs.forEach(m => {
        if (!map[m.client_id]) {
          map[m.client_id] = {
            client_id: m.client_id,
            name: m.clients?.name || 'Cliente eliminado',
            phone: m.clients?.phone || '',
            balance: 0, cargos: 0, pagos: 0, count: 0,
            last_at: m.created_at,
          };
        }
        const a = map[m.client_id];
        a.count++;
        if (m.type === 'cargo') { a.balance += Number(m.amount); a.cargos += Number(m.amount); }
        else { a.balance -= Number(m.amount); a.pagos += Number(m.amount); }
        if (new Date(m.created_at) > new Date(a.last_at)) a.last_at = m.created_at;
      });
      setAccounts(Object.values(map).sort((a, b) => b.balance - a.balance));
    } catch (e) {
      console.error('Error loading accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const deudaTotal = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const aFavorTotal = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const conDeuda = accounts.filter(a => a.balance > 0).length;
  const cobrado = movements.filter(m => m.type === 'pago').reduce((s, m) => s + Number(m.amount), 0);

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) || (a.phone || '').includes(search)
  );

  const detailClient = accounts.find(a => a.client_id === detailId);
  const detailMovs = movements.filter(m => m.client_id === detailId);

  const resetForms = () => {
    setCargoForm({ client_id: '', description: '', amount: '', notes: '' });
    setPagoForm({ client_id: '', amount: '', method: 'efectivo', notes: '' });
    setNewClient({ name: '', phone: '', email: '' });
  };

  const closeModal = () => { setModal(null); resetForms(); };

  const openPagoFor = (clientId) => {
    setPagoForm({ client_id: clientId, amount: '', method: 'efectivo', notes: '' });
    setModal('pago');
  };

  const handleCargo = async () => {
    if (!cargoForm.client_id || !cargoForm.description.trim() || !cargoForm.amount) return;
    setSaving(true);
    const { error } = await supabase.from('account_movements').insert({
      user_id: user.id,
      client_id: cargoForm.client_id,
      type: 'cargo',
      description: cargoForm.description.trim(),
      notes: cargoForm.notes.trim(),
      amount: parseFloat(cargoForm.amount),
    });
    setSaving(false);
    if (error) { alert('Error: ' + error.message); return; }
    closeModal();
    await load();
    showToast('Cargo registrado ✓');
  };

  const handlePago = async () => {
    if (!pagoForm.client_id || !pagoForm.amount) return;
    setSaving(true);
    const client = clients.find(c => c.id === pagoForm.client_id);
    const { data, error } = await supabase.from('account_movements').insert({
      user_id: user.id,
      client_id: pagoForm.client_id,
      type: 'pago',
      description: pagoForm.notes.trim() || 'Pago de cuenta corriente',
      notes: pagoForm.notes.trim(),
      amount: parseFloat(pagoForm.amount),
      method: pagoForm.method,
    }).select().single();

    if (error) { setSaving(false); alert('Error: ' + error.message); return; }

    // Registrar también el ingreso en caja
    const { error: cErr } = await supabase.from('cash_movements').insert({
      user_id: user.id,
      type: 'ingreso',
      description: `Cobro cuenta corriente — ${client?.name || ''}`,
      amount: parseFloat(pagoForm.amount),
      method: pagoForm.method,
      reference: `cc_${data.id}`,
    });
    if (cErr) console.error('Error registrando ingreso en caja:', cErr);

    setSaving(false);
    closeModal();
    await load();
    showToast('Pago registrado ✓ (ingresó a Caja)');
  };

  const handleNewClient = async () => {
    if (!newClient.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('clients').insert({
      user_id: user.id,
      name: newClient.name.trim(),
      phone: newClient.phone.trim(),
      email: newClient.email.trim(),
    }).select().single();
    setSaving(false);
    if (error) { alert('Error: ' + error.message); return; }
    setClients([...clients, data].sort((a, b) => a.name.localeCompare(b.name)));
    // Si venimos de un cargo/pago, asignarlo directo
    if (modal === 'cargo') setCargoForm({ ...cargoForm, client_id: data.id });
    if (modal === 'pago') setPagoForm({ ...pagoForm, client_id: data.id });
    setModal(modal === 'cliente' ? null : modal);
    setNewClient({ name: '', phone: '', email: '' });
    if (modal === 'cliente') showToast('Cliente creado ✓');
  };

  const handleDeleteMov = async (m) => {
    if (!confirm(`¿Eliminar este ${m.type === 'cargo' ? 'cargo' : 'pago'} de $${Number(m.amount).toLocaleString()}?`)) return;
    const { error } = await supabase.from('account_movements').delete().eq('id', m.id);
    if (error) { alert('Error: ' + error.message); return; }
    if (m.type === 'pago') {
      await supabase.from('cash_movements').delete().eq('reference', `cc_${m.id}`);
    }
    await load();
    showToast('Movimiento eliminado');
  };

  const fmt = (n) => '$' + Number(n || 0).toLocaleString();

  if (loading) {
    return (
      <div className="h-full bg-[#0f1219] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-4 flex-shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Cuentas Corrientes</h1>
          <p className="text-gray-500 text-xs mt-1">
            {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} • Deuda total:{' '}
            <span className="text-red-400 font-bold">{fmt(deudaTotal)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { resetForms(); setModal('cliente'); }}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
          <button onClick={() => { resetForms(); setModal('cargo'); }} disabled={clients.length === 0}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowUpRight className="w-4 h-4" />
            Nuevo Cargo
          </button>
          <button onClick={() => { resetForms(); setModal('pago'); }} disabled={clients.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowDownRight className="w-4 h-4" />
            Registrar Pago
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        {[
          { label: 'Deuda total', value: fmt(deudaTotal), tone: 'text-red-400', icon: ArrowUpRight, hint: `${conDeuda} cliente${conDeuda !== 1 ? 's' : ''} debe` },
          { label: 'A favor', value: fmt(aFavorTotal), tone: 'text-emerald-400', icon: ArrowDownRight, hint: 'Saldos a favor' },
          { label: 'Cobrado', value: fmt(cobrado), tone: 'text-primary-400', icon: Wallet, hint: `${movements.filter(m => m.type === 'pago').length} pago${movements.filter(m => m.type === 'pago').length !== 1 ? 's' : ''}` },
          { label: 'Clientes en cuenta', value: accounts.length, tone: 'text-white', icon: Users, hint: `${clients.length} en la base` },
        ].map((c, i) => (
          <div key={i} className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-3.5 flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0f1219] border border-gray-700/50 flex items-center justify-center flex-shrink-0">
              <c.icon className={`w-4 h-4 ${c.tone}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{c.label}</p>
              <p className={`text-base font-bold truncate ${c.tone}`}>{c.value}</p>
              <p className="text-[10px] text-gray-600 truncate">{c.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex-1 flex flex-col min-h-0">
        <div className="relative mb-4 flex-shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Buscar cliente..." className={inputClass + " pl-10"}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {accounts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {clients.length === 0
                  ? 'Primero creá un cliente con "Nuevo Cliente"'
                  : 'Sin cuentas corrientes aún — registrá un cargo para empezar'}
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Sin resultados</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-1">
            <table className="w-full text-sm">
              <thead className="bg-[#151a26] sticky top-0">
                <tr className="text-gray-400 text-left text-xs uppercase">
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Teléfono</th>
                  <th className="px-3 py-3 font-medium text-right">Debe</th>
                  <th className="px-3 py-3 font-medium text-right">A favor</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-3 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.client_id} className="border-t border-gray-700/30 text-gray-300 hover:bg-[#151a26] transition-colors">
                    <td className="px-3 py-3">
                      <p className="text-white font-medium">{a.name}</p>
                      <p className="text-[10px] text-gray-600">{a.count} movimiento{a.count !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{a.phone || '—'}</td>
                    <td className="px-3 py-3 text-right text-red-400 font-medium">{a.balance > 0 ? fmt(a.balance) : '—'}</td>
                    <td className="px-3 py-3 text-right text-emerald-400 font-medium">{a.balance < 0 ? fmt(Math.abs(a.balance)) : '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        a.balance > 0 ? 'bg-red-500/20 text-red-300'
                        : a.balance < 0 ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-gray-600/30 text-gray-400'
                      }`}>
                        {a.balance > 0 ? 'Con deuda' : a.balance < 0 ? 'A favor' : 'Al día'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailId(a.client_id)} className="text-gray-400 hover:text-primary-300 p-1 transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openPagoFor(a.client_id)} className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors" title="Registrar pago">
                          <ArrowDownRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cargo */}
      {modal === 'cargo' && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={closeModal}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-400" />
                Nuevo Cargo
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Cliente *</label>
                <select className={inputClass} value={cargoForm.client_id} onChange={e => setCargoForm({ ...cargoForm, client_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Concepto *</label>
                <input type="text" placeholder="Ej: Reparación de frenos..." className={inputClass}
                  value={cargoForm.description} onChange={e => setCargoForm({ ...cargoForm, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Monto *</label>
                <input type="number" min="0" placeholder="0" className={inputClass}
                  value={cargoForm.amount} onChange={e => setCargoForm({ ...cargoForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Notas</label>
                <textarea className={inputClass + " resize-none"} rows={2} placeholder="Opcional..."
                  value={cargoForm.notes} onChange={e => setCargoForm({ ...cargoForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handleCargo} disabled={saving || !cargoForm.client_id || !cargoForm.description.trim() || !cargoForm.amount}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Registrar Cargo'}
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Modal Pago */}
      {modal === 'pago' && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={closeModal}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                Registrar Pago
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-gray-500 bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2">
                El pago también ingresa automáticamente como <span className="text-emerald-400 font-medium">ingreso en Caja</span>.
              </p>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Cliente *</label>
                <select className={inputClass} value={pagoForm.client_id} onChange={e => setPagoForm({ ...pagoForm, client_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Monto *</label>
                <input type="number" min="0" placeholder="0" className={inputClass}
                  value={pagoForm.amount} onChange={e => setPagoForm({ ...pagoForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Método</label>
                <select className={inputClass} value={pagoForm.method} onChange={e => setPagoForm({ ...pagoForm, method: e.target.value })}>
                  {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Notas</label>
                <input type="text" placeholder="Opcional..." className={inputClass}
                  value={pagoForm.notes} onChange={e => setPagoForm({ ...pagoForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handlePago} disabled={saving || !pagoForm.client_id || !pagoForm.amount}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Registrar Pago'}
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Modal Nuevo Cliente */}
      {modal === 'cliente' && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={closeModal}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-400" />
                Nuevo Cliente
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Nombre *</label>
                <input type="text" placeholder="Nombre del cliente..." className={inputClass} autoFocus
                  value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Teléfono</label>
                <input type="tel" placeholder="Número..." className={inputClass}
                  value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Email</label>
                <input type="email" placeholder="email@..." className={inputClass}
                  value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handleNewClient} disabled={saving || !newClient.name.trim()}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Modal Detalle */}
      {detailId && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setDetailId(null)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary-400" />
                {detailClient?.name}
              </h2>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {detailClient && (
                <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                  detailClient.balance > 0 ? 'bg-red-500/10 border-red-500/30'
                  : detailClient.balance < 0 ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-gray-600/10 border-gray-700'
                }`}>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    {detailClient.balance > 0 ? 'Saldo que debe' : detailClient.balance < 0 ? 'Saldo a favor' : 'Cuenta al día'}
                  </span>
                  <span className={`text-xl font-bold ${
                    detailClient.balance > 0 ? 'text-red-400' : detailClient.balance < 0 ? 'text-emerald-400' : 'text-gray-400'
                  }`}>
                    {fmt(Math.abs(detailClient.balance))}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Cargos', fmt(detailClient?.cargos), 'text-amber-400'],
                  ['Pagos', fmt(detailClient?.pagos), 'text-emerald-400'],
                  ['Movimientos', detailClient?.count || 0, 'text-white'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-3">
                <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">Movimientos</p>
                {detailMovs.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-3">Sin movimientos</p>
                ) : (
                  <div className="space-y-2">
                    {detailMovs.map(m => (
                      <div key={m.id} className="bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            m.type === 'cargo' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {m.type === 'cargo' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{m.description || (m.type === 'cargo' ? 'Cargo' : 'Pago')}</p>
                            <p className="text-[11px] text-gray-500">
                              {new Date(m.created_at).toLocaleString('es-AR')}
                              {m.type === 'pago' && m.method ? ` • ${m.method}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-sm font-bold ${m.type === 'cargo' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {m.type === 'cargo' ? '+' : '−'}{fmt(m.amount)}
                          </span>
                          <button onClick={() => handleDeleteMov(m)} className="text-gray-600 hover:text-red-400 p-1 transition-colors" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setDetailId(null)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Cerrar</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
