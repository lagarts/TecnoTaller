import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, UserCheck, X, DollarSign, Trash2, Pencil, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const tareas = ['Mecánico', 'Electricista', 'Latonero', 'Pintor', 'Administrativo', 'Otro'];

export default function Trabajadores() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewWorker, setViewWorker] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [newWorker, setNewWorker] = useState({
    name: '', dni: '', doc_type: 'DNI', address: '', task: 'Mecánico', commission: '',
    phone: '', phone_alt: '', email: ''
  });
  const [payForm, setPayForm] = useState({
    worker_id: '', concept: '', amount: '', method: 'efectivo', discount_from_cash: false, notes: ''
  });
  const [payments, setPayments] = useState([]);

  const inputClass = "bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";

  useEffect(() => {
    loadWorkers();
    loadPayments();
  }, []);

  const loadWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (!error) setWorkers(data || []);
    } catch (error) {
      console.error('Error loading workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    const { data } = await supabase
      .from('worker_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPayments(data || []);
  };

  const handleCreateWorker = async () => {
    if (!newWorker.name.trim()) return;

    if (editingId) {
      const { data, error } = await supabase.from('workers').update({
        name: newWorker.name,
        dni: newWorker.dni,
        doc_type: newWorker.doc_type,
        address: newWorker.address,
        role: newWorker.task.toLowerCase(),
        task: newWorker.task,
        commission: parseFloat(newWorker.commission) || 0,
        phone: newWorker.phone,
        phone_alt: newWorker.phone_alt,
        email: newWorker.email,
      }).eq('id', editingId).select().single();

      if (data && !error) {
        setWorkers(workers.map(w => w.id === editingId ? data : w));
        setShowNewModal(false);
        setEditingId(null);
      }
      return;
    }

    const { data, error } = await supabase.from('workers').insert({
      user_id: user.id,
      name: newWorker.name,
      dni: newWorker.dni,
      doc_type: newWorker.doc_type,
      address: newWorker.address,
      role: newWorker.task.toLowerCase(),
      task: newWorker.task,
      commission: parseFloat(newWorker.commission) || 0,
      phone: newWorker.phone,
      phone_alt: newWorker.phone_alt,
      email: newWorker.email,
    }).select().single();

    if (data) {
      setWorkers([...workers, data]);
      setShowNewModal(false);
      setNewWorker({ name: '', dni: '', doc_type: 'DNI', address: '', task: 'Mecánico', commission: '', phone: '', phone_alt: '', email: '' });
    }
  };

  const handleEditWorker = (w) => {
    setEditingId(w.id);
    setNewWorker({
      name: w.name || '',
      dni: w.dni || '',
      doc_type: w.doc_type || 'DNI',
      address: w.address || '',
      task: w.task || 'Mecánico',
      commission: w.commission || '',
      phone: w.phone || '',
      phone_alt: w.phone_alt || '',
      email: w.email || '',
    });
    setShowNewModal(true);
  };

  const handleCloseModal = () => {
    setShowNewModal(false);
    setEditingId(null);
    setNewWorker({ name: '', dni: '', doc_type: 'DNI', address: '', task: 'Mecánico', commission: '', phone: '', phone_alt: '', email: '' });
  };

  const handlePayWorker = async () => {
    if (!payForm.worker_id || !payForm.concept || !payForm.amount) return;
    const { data, error } = await supabase.from('worker_payments').insert({
      user_id: user.id,
      worker_id: payForm.worker_id,
      concept: payForm.concept,
      amount: parseFloat(payForm.amount),
      method: payForm.method,
      discount_from_cash: payForm.discount_from_cash,
      notes: payForm.notes,
    }).select().single();

    if (data) {
      setPayments([data, ...payments]);
      setShowPayModal(false);
      setPayForm({ worker_id: '', concept: '', amount: '', method: 'efectivo', discount_from_cash: false, notes: '' });
    }
  };

  const deleteWorker = async (id) => {
    await supabase.from('workers').delete().eq('id', id);
    setWorkers(workers.filter(w => w.id !== id));
  };

  const filtered = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.dni || '').includes(search)
  );

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Trabajadores</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowPayModal(true); setPayForm({ worker_id: '', concept: '', amount: '', method: 'efectivo', discount_from_cash: false, notes: '' }); }} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <DollarSign className="w-4 h-4" />
            Pagar
          </button>
          <button onClick={() => { setShowNewModal(true); setNewWorker({ name: '', dni: '', doc_type: 'DNI', address: '', task: 'Mecánico', commission: '', phone: '', phone_alt: '', email: '' }); }} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="Buscar por nombre o DNI..." className={inputClass + " pl-10"} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <UserCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{workers.length === 0 ? 'No hay trabajadores aún' : 'Sin resultados'}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Nombre</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">DNI</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">ID</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Teléfono</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Domicilio</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Comisión</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} className="border-b border-gray-700/50 hover:bg-[#222839] transition-colors">
                    <td className="py-3 px-3 text-white font-medium">{w.name}</td>
                    <td className="py-3 px-3 text-gray-400">{w.dni || '-'}</td>
                    <td className="py-3 px-3 text-gray-500 text-xs">{w.id?.substring(0, 8)}...</td>
                    <td className="py-3 px-3 text-gray-400">{w.phone || '-'}</td>
                    <td className="py-3 px-3 text-gray-400">{w.address || '-'}</td>
                    <td className="py-3 px-3 text-gray-400">{w.commission ? `${w.commission}%` : '-'}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewWorker(w)} className="text-gray-400 hover:text-gray-200 p-1 transition-colors" title="Ver datos">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditWorker(w)} className="text-primary-400 hover:text-primary-300 p-1 transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteWorker(w.id)} className="text-red-400 hover:text-red-300 p-1 transition-colors" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
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

      {showNewModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={handleCloseModal}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Editar Trabajador' : 'Nuevo Trabajador'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Nombre *</label>
                  <input type="text" className={inputClass} value={newWorker.name} onChange={e => setNewWorker({ ...newWorker, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Tipo documento</label>
                  <select className={inputClass} value={newWorker.doc_type} onChange={e => setNewWorker({ ...newWorker, doc_type: e.target.value })}>
                    <option>DNI</option><option>CUIL</option><option>CUIT</option><option>Pasaporte</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Domicilio</label>
                  <input type="text" className={inputClass} value={newWorker.address} onChange={e => setNewWorker({ ...newWorker, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">DNI *</label>
                  <input type="text" className={inputClass} value={newWorker.dni} onChange={e => setNewWorker({ ...newWorker, dni: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Tarea</label>
                  <select className={inputClass} value={newWorker.task} onChange={e => setNewWorker({ ...newWorker, task: e.target.value })}>
                    {tareas.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Comisión %</label>
                  <input type="number" step="0.01" className={inputClass} placeholder="Ej: Para 5% ingresar 0.05" value={newWorker.commission} onChange={e => setNewWorker({ ...newWorker, commission: e.target.value })} />
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Contacto</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Teléfono</label>
                    <input type="tel" className={inputClass} value={newWorker.phone} onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Email</label>
                    <input type="email" className={inputClass} value={newWorker.email} onChange={e => setNewWorker({ ...newWorker, email: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs text-gray-400">Teléfono alternativo</label>
                  <input type="tel" className={inputClass} value={newWorker.phone_alt} onChange={e => setNewWorker({ ...newWorker, phone_alt: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleCloseModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handleCreateWorker} disabled={!newWorker.name.trim()} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {editingId ? 'Guardar Cambios' : 'Crear Trabajador'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPayModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Pago a Trabajador</h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Trabajador *</label>
                  <select className={inputClass} value={payForm.worker_id} onChange={e => setPayForm({ ...payForm, worker_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Concepto *</label>
                  <select className={inputClass} value={payForm.concept} onChange={e => setPayForm({ ...payForm, concept: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    <option>Sueldo</option>
                    <option>Comisión</option>
                    <option>Horas extras</option>
                    <option>Adelanto</option>
                    <option>Otro</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#0f1219] border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">Pago</h3>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={payForm.discount_from_cash} onChange={e => setPayForm({ ...payForm, discount_from_cash: e.target.checked })} className="rounded" />
                    Descontar de caja
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Método</label>
                    <select className={inputClass} value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Monto *</label>
                    <input type="number" className={inputClass} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Comentario</label>
                <textarea className={inputClass + " resize-none"} rows={2} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handlePayWorker} disabled={!payForm.worker_id || !payForm.concept || !payForm.amount} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Registrar Pago</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {viewWorker && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setViewWorker(null)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-400" />
                Datos del Trabajador
              </h2>
              <button onClick={() => setViewWorker(null)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                ['Nombre', viewWorker.name],
                ['Tipo documento', viewWorker.doc_type || '-'],
                ['DNI', viewWorker.dni || '-'],
                ['Tarea', viewWorker.task || '-'],
                ['Comisión', viewWorker.commission ? `${viewWorker.commission}%` : '-'],
                ['Domicilio', viewWorker.address || '-'],
                ['Teléfono', viewWorker.phone || '-'],
                ['Tel. alternativo', viewWorker.phone_alt || '-'],
                ['Email', viewWorker.email || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-start gap-4 bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5">
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                  <span className="text-sm text-white text-right">{value}</span>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button onClick={() => setViewWorker(null)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Cerrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}