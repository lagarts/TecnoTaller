import { useState, useEffect } from 'react';
import { PieChart, ChevronLeft, ChevronRight, CreditCard, Layers, ArrowUpRight, ArrowDownRight, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, MONTHS, METHOD_LABELS, METHOD_COLORS } from './utils';
import { StatCard, ChartCard, EmptyState } from './ui';

export default function VentaDividida() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // -1 = todo el año
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

  const periodMovs = movements.filter(m => {
    const d = new Date(m.created_at);
    if (d.getFullYear() !== year) return false;
    if (month === -1) return true;
    return d.getMonth() === month;
  });

  const ingresos = periodMovs.filter(m => m.type === 'ingreso');
  const egresos = periodMovs.filter(m => m.type === 'egreso');
  const totalIngresos = ingresos.reduce((a, m) => a + Number(m.amount), 0);
  const totalEgresos = egresos.reduce((a, m) => a + Number(m.amount), 0);

  // División por método de pago (solo ingresos)
  const byMethod = Object.keys(METHOD_LABELS).map(key => {
    const movs = ingresos.filter(m => (m.method || 'efectivo') === key);
    return {
      key,
      label: METHOD_LABELS[key],
      color: METHOD_COLORS[key],
      total: movs.reduce((a, m) => a + Number(m.amount), 0),
      count: movs.length,
    };
  }).filter(m => m.count > 0).sort((a, b) => b.total - a.total);

  const maxMethod = Math.max(...byMethod.map(m => m.total), 1);

  // División por origen: órdenes de trabajo vs movimientos manuales
  const conOrden = ingresos.filter(m => m.order_id);
  const manual = ingresos.filter(m => !m.order_id);
  const totalConOrden = conOrden.reduce((a, m) => a + Number(m.amount), 0);
  const totalManual = manual.reduce((a, m) => a + Number(m.amount), 0);
  const maxOrigen = Math.max(totalConOrden, totalManual, 1);

  const efectivo = byMethod.find(m => m.key === 'efectivo');
  const pctEfectivo = totalIngresos > 0 ? Math.round((efectivo ? efectivo.total : 0) / totalIngresos * 100) : 0;

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < -1) { m = -1; }
    if (m > 11) { m = -1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const periodLabel = month === -1 ? `Todo el año ${year}` : `${MONTHS[month]} ${year}`;

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
          <PieChart className="w-6 h-6 text-primary-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Venta Dividida</h1>
            <p className="text-gray-500 text-xs truncate">{periodLabel} • {periodMovs.length} movimiento{periodMovs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#1a1f2e] border border-gray-700 rounded-lg px-1 py-1 flex-shrink-0">
          <button onClick={() => changeMonth(-1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex flex-col items-center px-1">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer text-center"
            >
              <option value={-1} className="bg-[#1a1f2e]">Todo el año</option>
              {MONTHS.map((m, i) => <option key={i} value={i} className="bg-[#1a1f2e]">{m}</option>)}
            </select>
            <span className="text-[10px] text-gray-500">{year}</span>
          </div>
          <button onClick={() => changeMonth(1)} className="text-gray-400 hover:text-white p-1.5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <StatCard icon={ArrowUpRight} label="Ingresos" value={fmtMoney(totalIngresos)} tone="green" />
        <StatCard icon={ArrowDownRight} label="Egresos" value={fmtMoney(totalEgresos)} tone="red" />
        <StatCard icon={Percent} label="% Efectivo" value={`${pctEfectivo}%`} tone="blue" hint={fmtMoney(efectivo ? efectivo.total : 0)} />
        <StatCard icon={CreditCard} label="Métodos usados" value={byMethod.length} hint={`${ingresos.length} cobro${ingresos.length !== 1 ? 's' : ''}`} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-2">
        {periodMovs.length === 0 ? (
          <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl">
            <EmptyState icon={PieChart} text={`Sin movimientos en ${periodLabel}`} />
          </div>
        ) : (
          <>
            {/* Por método de pago */}
            <ChartCard title="Ingresos por método de pago">
              <div className="space-y-3">
                {byMethod.map(m => {
                  const pct = totalIngresos > 0 ? Math.round(m.total / totalIngresos * 100) : 0;
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-sm text-gray-300">
                          <span className={`w-2.5 h-2.5 rounded-full ${m.color.dot}`}></span>
                          {m.label}
                          <span className="text-[10px] text-gray-600">({m.count})</span>
                        </span>
                        <span className="text-sm text-white font-medium">
                          {fmtMoney(m.total)}
                          <span className="text-gray-500 ml-2 text-xs">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-[#0f1219] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.color.bar}`} style={{ width: `${(m.total / maxMethod) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            {/* Ingresos vs Egresos */}
            <ChartCard title="Ingresos vs Egresos">
              <div className="space-y-3">
                {[
                  { label: 'Ingresos', value: totalIngresos, color: 'bg-emerald-500', text: 'text-emerald-400', icon: ArrowUpRight },
                  { label: 'Egresos', value: totalEgresos, color: 'bg-red-400', text: 'text-red-400', icon: ArrowDownRight },
                ].map(row => {
                  const max = Math.max(totalIngresos, totalEgresos, 1);
                  const pct = totalIngresos + totalEgresos > 0 ? Math.round(row.value / (totalIngresos + totalEgresos) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`flex items-center gap-2 text-sm ${row.text}`}>
                          <row.icon className="w-4 h-4" />
                          {row.label}
                        </span>
                        <span className="text-sm text-white font-medium">
                          {fmtMoney(row.value)}
                          <span className="text-gray-500 ml-2 text-xs">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-[#0f1219] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / max) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            {/* Por origen */}
            <ChartCard title="Ingresos por origen">
              <div className="space-y-3">
                {[
                  { label: 'Órdenes de trabajo', value: totalConOrden, count: conOrden.length, color: 'bg-primary-500' },
                  { label: 'Movimientos manuales', value: totalManual, count: manual.length, color: 'bg-gray-500' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-sm text-gray-300">
                        <Layers className="w-4 h-4 text-gray-500" />
                        {row.label}
                        <span className="text-[10px] text-gray-600">({row.count})</span>
                      </span>
                      <span className="text-sm text-white font-medium">
                        {fmtMoney(row.value)}
                        <span className="text-gray-500 ml-2 text-xs">
                          {totalIngresos > 0 ? Math.round(row.value / totalIngresos * 100) : 0}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-[#0f1219] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / maxOrigen) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}
