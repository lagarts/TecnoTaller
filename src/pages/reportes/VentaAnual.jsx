import { useState, useEffect } from 'react';
import { Activity, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Trophy, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, MONTHS, MONTHS_SHORT } from './utils';
import { StatCard, ChartCard, TableCard } from './ui';

export default function VentaAnual() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('cash_movements')
        .select('type, amount, method, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setMovements(data || []);
    } catch (e) {
      console.error('Error loading movements:', e);
    } finally {
      setLoading(false);
    }
  };

  const yearMovs = movements.filter(m => new Date(m.created_at).getFullYear() === year);

  const monthly = MONTHS.map((name, i) => {
    const movs = yearMovs.filter(m => new Date(m.created_at).getMonth() === i);
    const ingresos = movs.filter(m => m.type === 'ingreso').reduce((a, m) => a + Number(m.amount), 0);
    const egresos = movs.filter(m => m.type === 'egreso').reduce((a, m) => a + Number(m.amount), 0);
    return { name, short: MONTHS_SHORT[i], ingresos, egresos, balance: ingresos - egresos, count: movs.length };
  });

  const totalIngresos = monthly.reduce((a, m) => a + m.ingresos, 0);
  const totalEgresos = monthly.reduce((a, m) => a + m.egresos, 0);
  const activeMonths = monthly.filter(m => m.count > 0);
  const bestMonth = activeMonths.length
    ? activeMonths.reduce((a, b) => (b.ingresos > a.ingresos ? b : a))
    : null;

  const maxMonthly = Math.max(...monthly.map(m => Math.max(m.ingresos, m.egresos)), 1);
  const BAR_MAX = 150;

  if (loading) {
    return (
      <div className="h-full bg-[#0f1219] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Activity className="w-6 h-6 text-primary-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Venta Anual</h1>
            <p className="text-gray-500 text-xs">{yearMovs.length} movimiento{yearMovs.length !== 1 ? 's' : ''} en {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#1a1f2e] border border-gray-700 rounded-lg px-1 py-1 flex-shrink-0">
          <button onClick={() => setYear(year - 1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-white font-medium px-3 min-w-[70px] text-center">{year}</span>
          <button onClick={() => setYear(year + 1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <StatCard icon={ArrowUpRight} label="Ingresos del año" value={fmtMoney(totalIngresos)} tone="green" />
        <StatCard icon={ArrowDownRight} label="Egresos del año" value={fmtMoney(totalEgresos)} tone="red" />
        <StatCard icon={Activity} label="Balance" value={fmtMoney(totalIngresos - totalEgresos)} tone={totalIngresos - totalEgresos >= 0 ? 'green' : 'red'} />
        <StatCard
          icon={Trophy}
          label="Mejor mes"
          value={bestMonth ? bestMonth.short : '—'}
          tone="yellow"
          hint={bestMonth ? fmtMoney(bestMonth.ingresos) : 'Sin datos'}
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        <ChartCard
          title={`Ventas por mes — ${year}`}
          legend={[
            { label: 'Ingresos', color: 'bg-emerald-500' },
            { label: 'Egresos', color: 'bg-red-400' },
          ]}
        >
          <div className="flex items-end gap-2" style={{ height: BAR_MAX + 20 }}>
            {monthly.map((m, i) => (
              <div key={i} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center">
                <div className="w-full flex items-end justify-center gap-[2px]" style={{ height: BAR_MAX }}>
                  <div
                    className="w-1/2 bg-emerald-500 rounded-t"
                    style={{ height: m.ingresos > 0 ? Math.max((m.ingresos / maxMonthly) * BAR_MAX, 3) : 0 }}
                    title={`${m.name} — Ingresos: ${fmtMoney(m.ingresos)}`}
                  />
                  <div
                    className="w-1/2 bg-red-400 rounded-t"
                    style={{ height: m.egresos > 0 ? Math.max((m.egresos / maxMonthly) * BAR_MAX, 3) : 0 }}
                    title={`${m.name} — Egresos: ${fmtMoney(m.egresos)}`}
                  />
                </div>
                <span className={`text-[9px] mt-1 leading-none ${m.count > 0 ? 'text-gray-400' : 'text-gray-600'}`}>{m.short}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <div className="pb-2">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">Resumen mensual</p>
          <TableCard
            headers={[
              { label: 'Mes' },
              { label: 'Movimientos', align: 'right' },
              { label: 'Ingresos', align: 'right' },
              { label: 'Egresos', align: 'right' },
              { label: 'Balance', align: 'right' },
            ]}
          >
            {monthly.map((m, i) => (
              <tr key={i} className={`border-t border-gray-700/30 text-gray-300 ${m.count === 0 ? 'opacity-40' : ''} ${bestMonth && m.name === bestMonth.name ? 'bg-yellow-500/5' : ''}`}>
                <td className="px-4 py-3 text-white font-medium">
                  {m.name}
                  {bestMonth && m.name === bestMonth.name && <span className="ml-2 text-[10px] text-yellow-400">★ mejor</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">{m.count}</td>
                <td className="px-4 py-3 text-right text-emerald-400">{m.ingresos > 0 ? fmtMoney(m.ingresos) : '—'}</td>
                <td className="px-4 py-3 text-right text-red-400">{m.egresos > 0 ? fmtMoney(m.egresos) : '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${m.balance > 0 ? 'text-white' : m.balance < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {m.count > 0 ? fmtMoney(m.balance) : '—'}
                </td>
              </tr>
            ))}
          </TableCard>
        </div>
      </div>
    </div>
  );
}
