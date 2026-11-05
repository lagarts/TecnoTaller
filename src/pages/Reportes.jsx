import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Activity, PieChart } from 'lucide-react';

const reportesOptions = [
  { label: 'Historial de Caja', path: '/reportes/historial-caja', icon: DollarSign, emoji: '💰', desc: 'Movimientos de caja' },
  { label: 'Venta Mensual', path: '/reportes/venta-mensual', icon: TrendingUp, emoji: '📈', desc: 'Resumen mensual' },
  { label: 'Venta Anual', path: '/reportes/venta-anual', icon: Activity, emoji: '📊', desc: 'Resumen anual' },
  { label: 'Venta Dividida', path: '/reportes/venta-dividida', icon: PieChart, emoji: '🥧', desc: 'Por método y origen' },
];

export default function Reportes() {
  const navigate = useNavigate();

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Reportes</h1>
        <p className="text-gray-500 text-xs mt-1">Seleccioná un reporte</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1 content-start">
        {reportesOptions.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="group bg-[#1a1f2e] hover:bg-[#222839] border border-gray-700/50 hover:border-primary-500/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10 cursor-pointer"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
              {card.emoji}
            </span>
            <span className="text-white group-hover:text-primary-300 text-sm font-bold text-center">
              {card.label}
            </span>
            <span className="text-gray-500 text-[10px] text-center leading-tight">
              {card.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}