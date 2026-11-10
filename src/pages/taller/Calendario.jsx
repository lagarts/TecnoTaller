import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Check, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function Calendario() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [clients, setClients] = useState([]);
  const [searchClient, setSearchClient] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState(() => localStorage.getItem('whatsapp_template') || '');

  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    event_time: '09:00',
    type: 'turno',
    notes: '',
  });

  useEffect(() => {
    loadEvents();
    loadClients();
  }, []);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id);

      if (!error) setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, name, phone, email').eq('user_id', user.id).order('name');
    setClients(data || []);
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDay = (date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDay(currentDate);
  const monthName = currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const getEventsForDay = (day) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const handleDayClick = (day) => {
    const dayEvents = getEventsForDay(day);
    if (dayEvents.length > 0) {
      setSelectedDayEvents(dayEvents);
      setSelectedDay(day);
      setShowDayModal(true);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.event_date || !newEvent.event_time) return;

    const { data, error } = await supabase.from('calendar_events').insert({
      user_id: user.id,
      title: selectedClient ? selectedClient.name : newEvent.title,
      event_date: newEvent.event_date,
      event_time: newEvent.event_time,
      type: 'turno',
      notes: newEvent.notes,
      client_id: selectedClient?.id || null,
      client_name: selectedClient?.name || newEvent.title,
      client_phone: selectedClient?.phone || newEvent.client_phone || '',
    }).select().single();

    if (data) {
      setEvents([...events, data]);
      setShowModal(false);
      setNewEvent({ title: '', event_date: '', event_time: '09:00', type: 'turno', notes: '', client_phone: '' });
      setSelectedClient(null);
      setSearchClient('');
    }
  };

  const sendWhatsApp = (evt) => {
    const phone = evt.client_phone?.replace(/\D/g, '') || '';
    const template = localStorage.getItem('whatsapp_template') || '';
    const message = template || `Hola ${evt.client_name || 'Cliente'}, te confirmamos tu turno en TecnoTaller. ¡Te esperamos! 📋🔧`;
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const today = new Date();
  const inputClass = "bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full";
  const inputSmall = "bg-[#1a1f2e] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Calendario</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowWhatsappModal(true); }} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </button>
          <button onClick={() => { setShowModal(true); setNewEvent({ ...newEvent, event_date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}` }); }} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Agregar Turno
          </button>
        </div>
      </div>

      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-[#222839] rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h2 className="text-lg font-bold text-white capitalize">{monthName}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-[#222839] rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-px bg-gray-700 rounded-lg overflow-hidden flex-1">
          {days.map(d => (
            <div key={d} className="bg-[#1a1f2e] py-2 text-center text-xs font-bold text-gray-400 uppercase">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-[#0f1219] min-h-[80px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const hasEvents = dayEvents.length > 0;
            const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={`min-h-[80px] p-1.5 transition-colors ${hasEvents ? 'bg-[#1e3a5f] hover:bg-[#24456a] cursor-pointer' : 'bg-[#0f1219] hover:bg-[#1a1f2e]'} ${isToday ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
              >
                <span className={`text-xs font-semibold ${isToday ? 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-400'}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map(evt => (
                    <div key={evt.id} className="text-[10px] bg-primary-600/30 text-primary-300 px-1 py-0.5 rounded truncate border-l-2 border-primary-500">
                      {evt.event_time} {evt.client_name || evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[10px] text-gray-500 pl-1">+{dayEvents.length - 2} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Agregar Turno</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Buscar cliente</label>
                <input type="text" placeholder="Nombre del cliente..." className={inputClass} value={searchClient} onChange={e => { setSearchClient(e.target.value); if (e.target.value) setShowClientPicker(true); }} onFocus={() => setShowClientPicker(true)} onBlur={() => setTimeout(() => setShowClientPicker(false), 200)} />
                {showClientPicker && (
                  <div className="bg-[#0f1219] border border-gray-600 rounded-lg shadow-xl max-h-32 overflow-y-auto">
                    {clients.filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase())).map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setSearchClient(c.name); setShowClientPicker(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#222839]">{c.name} - {c.phone}</button>
                    ))}
                    {clients.filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
                    )}
                  </div>
                )}
              </div>

              {!selectedClient && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Nombre del cliente *</label>
                  <input type="text" placeholder="Nombre..." className={inputClass} value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                </div>
              )}

              {!selectedClient && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Celular *</label>
                  <input type="tel" placeholder="Número de celular..." className={inputClass} value={newEvent.client_phone || ''} onChange={e => setNewEvent({ ...newEvent, client_phone: e.target.value })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Fecha</label>
                  <input type="date" className={inputClass} value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Hora</label>
                  <input type="time" className={inputClass} value={newEvent.event_time} onChange={e => setNewEvent({ ...newEvent, event_time: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Observaciones</label>
                <textarea className={inputClass + " resize-none"} rows={2} placeholder="Opcional..." value={newEvent.notes} onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={handleAddEvent} disabled={!newEvent.event_date || !newEvent.event_time || (!selectedClient && (!newEvent.title.trim() || !newEvent.client_phone?.trim()))} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Guardar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDayModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setShowDayModal(false)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Turnos del {selectedDay}/{currentDate.getMonth() + 1}</h2>
              <button onClick={() => setShowDayModal(false)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {selectedDayEvents.map(evt => (
                <div key={evt.id} className="bg-[#0f1219] border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary-400" />
                      <span className="text-sm font-bold text-white">{evt.event_time?.substring(0, 5)}</span>
                    </div>
                    {evt.client_phone && (
                      <button onClick={() => sendWhatsApp(evt)} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg text-xs transition-colors">
                        <MessageCircle className="w-3 h-3" />
                        WhatsApp
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{evt.client_name || evt.title}</span>
                  </div>
                  {evt.client_phone && (
                    <p className="text-xs text-gray-500 mt-1 ml-6">Tel: {evt.client_phone}</p>
                  )}
                  {evt.notes && (
                    <p className="text-xs text-gray-500 mt-1 ml-6">{evt.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showWhatsappModal && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setShowWhatsappModal(false)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Mensaje predeterminado WhatsApp</h2>
              <button onClick={() => setShowWhatsappModal(false)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-400">Este mensaje se enviará a cada cliente cuando hagas click en el botón verde de WhatsApp en cualquier turno.</p>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Mensaje</label>
                <textarea className={inputClass + " resize-none"} rows={6} placeholder="Escribí el mensaje que se enviará a tus clientes..." value={whatsappTemplate} onChange={e => setWhatsappTemplate(e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowWhatsappModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button onClick={() => { localStorage.setItem('whatsapp_template', whatsappTemplate); setShowWhatsappModal(false); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}