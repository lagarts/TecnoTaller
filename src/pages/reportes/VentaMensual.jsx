import { useState, useEffect } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Activity, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, fmtDateTime, MONTHS, METHOD_LABELS } from './utils';
import { StatCard, ChartCard, EmptyState, TableCard } from './ui';

export default function VentaMensual() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('cash_movements')
        .select('type, amount, method, description, created_at, order_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setMovements(data || []);
    } catch (e) {
      console.error('Error loading movements:', e);
    } finally {
      setLoading(false);
    }
  };

  const monthMovs = movements.filter(m => {
    const d = new Date(m.created_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const ingresos = monthMovs.filter(m => m.type === 'ingreso').reduce((a, m) => a + Number(m.amount), 0);
  const egresos = monthMovs.filter(m => m.type === 'egreso').reduce((a, m) => a + Number(m.amount), 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, ingresos: 0, egresos: 0 }));
  monthMovs.forEach(m => {
    const day = new Date(m.created_at).getDate();
    if (m.type === 'ingreso') daily[day - 1].ingresos += Number(m.amount);
    else daily[day - 1].egresos += Number(m.amount);
  });
  const maxDaily = Math.max(...daily.map(d => Math.max(d.ingresos, d.egresos)), 1);
  const BAR_MAX = 130;

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

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
          <TrendingUp className="w-6 h-6 text-primary-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Venta Mensual</h1>
            <p className="text-gray-500 text-xs">{monthMovs.length} movimiento{monthMovs.length !== 1 ? 's' : ''} en el mes</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#1a1f2e] border border-gray-700 rounded-lg px-1 py-1 flex-shrink-0">
          <button onClick={() => changeMonth(-1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-white font-medium px-2 min-w-[140px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={() => changeMonth(1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <StatCard icon={ArrowUpRight} label="Ingresos" value={fmtMoney(ingresos)} tone="green" />
        <StatCard icon={ArrowDownRight} label="Egresos" value={fmtMoney(egresos)} tone="red" />
        <StatCard icon={Activity} label="Balance" value={fmtMoney(ingresos - egresos)} tone={ingresos - egresos >= 0 ? 'green' : 'red'} />
        <StatCard icon={Calendar} label="Movimientos" value={monthMovs.length} hint={`${daily.filter(d => d.ingresos > 0 || d.egresos > 0).length} días con actividad`} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        <ChartCard
          title={`Movimientos por día — ${MONTHS[month]}`}
          legend={[
            { label: 'Ingresos', color: 'bg-emerald-500' },
            { label: 'Egresos', color: 'bg-red-400' },
          ]}
        >
          {monthMovs.length === 0 ? (
            <EmptyState icon={TrendingUp} text="Sin movimientos en este mes" />
          ) : (
            <div className="flex items-end gap-[3px]" style={{ height: BAR_MAX + 18 }}>
              {daily.map(d => (
                <div key={d.day} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center">
                  <div className="w-full flex items-end justify-center gap-[1px]" style={{ height: BAR_MAX }}>
                    <div
                      className="w-1/2 bg-emerald-500 rounded-t transition-all"
                      style={{ height: d.ingresos > 0 ? Math.max((d.ingresos / maxDaily) * BAR_MAX, 3) : 0 }}
                      title={`Día ${d.day} — Ingresos: ${fmtMoney(d.ingresos)}`}
                    />
                    <div
                      className="w-1/2 bg-red-400 rounded-t transition-all"
                      style={{ height: d.egresos > 0 ? Math.max((d.egresos / maxDaily) * BAR_MAX, 3) : 0 }}
                      title={`Día ${d.day} — Egresos: ${fmtMoney(d.egresos)}`}
                    />
                  </div>
                  <span className="text-[8px] text-gray-600 mt-1 leading-none">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <div className="pb-2">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">Detalle del mes</p>
          {monthMovs.length === 0 ? (
            <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl">
              <EmptyState icon={Calendar} text="No hay movimientos para este mes" />
            </div>
          ) : (
            <TableCard
              headers={[
                { label: 'Fecha' },
                { label: 'Descripción' },
                { label: 'Método' },
                { label: 'Tipo' },
                { label: 'Monto', align: 'right' },
              ]}
            >
              {[...monthMovs].reverse().map((m, i) => (
                <tr key={i} className="border-t border-gray-700/30 text-gray-300">
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                  <td className="px-4 py-3 text-white">{m.description || '(sin descripción)'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{METHOD_LABELS[m.method] || m.method}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      m.type === 'ingreso' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {m.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${m.type === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.type === 'ingreso' ? '+' : '−'}{fmtMoney(m.amount)}
                  </td>
                </tr>
              ))}
            </TableCard>
          )}
        </div>
      </div>
    </div>
  );
}
