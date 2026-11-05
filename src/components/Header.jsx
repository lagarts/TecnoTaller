import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, Search, Menu, ChevronRight, CheckCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const location = useLocation();
  const [notis, setNotis] = useState([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const panelRef = useRef(null);

  const getBreadcrumb = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '));
  };

  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`notis_read_${user.id}`);
    setReadIds(stored ? JSON.parse(stored) : []);
    loadNotis();

    const channel = supabase
      .channel('notifications-header')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotis(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const loadNotis = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setNotis(data || []);
  };

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notis.filter(n => !readIds.includes(n.id));

  const markAsRead = (id) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    localStorage.setItem(`notis_read_${user.id}`, JSON.stringify(next));
  };

  const markAllRead = () => {
    const next = notis.map(n => n.id);
    setReadIds(next);
    localStorage.setItem(`notis_read_${user.id}`, JSON.stringify(next));
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <button onClick={onMenuToggle} className="lg:hidden text-gray-500 hover:text-primary-600 p-1">
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
            {getBreadcrumb().map((part, i, arr) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
                <span className={i === arr.length - 1 ? 'text-primary-600 font-medium' : ''}>{part}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 transition-all"
            />
          </div>

          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setOpen(!open)}
              className="relative p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unread.length > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread.length > 9 ? '9+' : unread.length}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                  {unread.length > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                      <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notis.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No hay notificaciones</p>
                    </div>
                  ) : (
                    notis.map(n => (
                      <button
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                          readIds.includes(n.id) ? 'opacity-60' : 'bg-primary-50/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!readIds.includes(n.id) && (
                            <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('es-AR')}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">{user?.name || 'Usuario'}</p>
              <p className="text-xs text-gray-400">{user?.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}