import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, ClipboardList, BookOpen, Calendar, Bell, Car, History, Wrench,
  ShoppingBag, DollarSign, CreditCard, Package, UserCheck, Phone,
  BarChart3, FileText, Settings, Users, Shield
} from 'lucide-react';

const menuCards = [
  { label: 'Taller', path: '/taller', icon: Wrench, emoji: '🔧' },
  { label: 'Caja', path: '/caja', icon: DollarSign, emoji: '💰' },
  { label: 'Cuentas Corrientes', path: '/cuenta-corrientes', icon: CreditCard, emoji: '💳' },
  { label: 'Inventario', path: '/inventario', icon: Package, emoji: '📦' },
  { label: 'Trabajadores', path: '/trabajadores', icon: UserCheck, emoji: '👷' },
  { label: 'Clientes', path: '/clientes', icon: Phone, emoji: '📞' },
  { label: 'Reportes', path: '/reportes', icon: BarChart3, emoji: '📊' },
  { label: 'Informes', path: '/informes', icon: FileText, emoji: '📝' },
  { label: 'Configuración', path: '/configuracion', icon: Settings, emoji: '⚙️' },
  { label: 'Mi Cuenta', path: '/mi-cuenta', icon: Users, emoji: '👤' },
];

const adminCard = { label: 'Admin', path: '/admin', icon: Shield, emoji: '🛡️' };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'worker') navigate('/cobros/mis-cobros', { replace: true });
  }, [user, navigate]);

  const allCards = user?.role === 'admin' ? [...menuCards, adminCard] : menuCards;

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="flex flex-col items-center mb-3 pt-1 flex-shrink-0">
        <img src="/logo.svg" alt="TecnoTaller" className="w-12 h-12 mb-1 drop-shadow-lg" />
        <h1 className="text-lg font-bold">
          <span className="text-blue-400">Tecno</span><span className="text-white">Taller</span>
        </h1>
        <p className="text-gray-400 text-[9px] uppercase tracking-widest">Soluciones Automotrices</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 content-start">
        {allCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="aspect-square group relative bg-[#1a1f2e] hover:bg-[#222839] border border-gray-700/50 hover:border-primary-500/50 rounded-xl p-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10 cursor-pointer"
          >
            <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
              {card.emoji}
            </span>
            <span className="text-gray-300 group-hover:text-white text-xs font-medium text-center leading-tight">
              {card.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
