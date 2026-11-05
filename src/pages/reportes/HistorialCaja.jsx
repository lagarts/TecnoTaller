import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign, Wallet, Eye, X, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, fmtDateTime } from './utils';
import { StatCard, EmptyState, TableCard } from './ui';

export default function HistorialCaja() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        supabase.from('cash_register')
          .select('*')
          .eq('user_id', user.id)
          .order('opened_at', { ascending: false }),
        supabase.from('cash_movements')
          .select('type, amount, method, description, created_at, order_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);
      setSessions(sRes.data || []);
      setMovements(mRes.data || []);
    } catch (e) {
      console.error('Error loading caja history:', e);
    } finally {
      setLoading(false);
    }
  };

  const sessionStats = (s) => {
    const from = new Date(s.opened_at);
    const to = s.closed_at ? new Date(s.closed_at) : new Date();
    const movs = movements.filter(m => {
      const d = new Date(m.created_at);
      return d >= from && d <= to;
    });
    const ingresos = movs.filter(m => m.type === 'ingreso').reduce((a, m) => a + Number(m.amount), 0);
    const egresos = movs.filter(m => m.type === 'egreso').reduce((a, m) => a + Number(m.amount), 0);
    return { movs, ingresos, egresos, resultado: Number(s.opening_amount) + ingresos - egresos };
  };

  const totalIngresos = movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + Number(m.amount), 0);
  const totalEgresos = movements.filter(m => m.type === 'egreso').reduce((a, m) => a + Number(m.amount), 0);
  const cerradas = sessions.filter(s => s.status === 'cerrada').length;

  if (loading) {
    return (
      <div className="h-full bg-[#0f1219] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f1219] p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <DollarSign className="w-6 h-6 text-primary-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Historial de Caja</h1>
          <p className="text-gray-500 text-xs">{sessions.length} apertura{sessions.length !== 1 ? 's' : ''} de caja</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <StatCard icon={Wallet} label="Sesiones" value={sessions.length} hint={`${cerradas} cerrada${cerradas !== 1 ? 's' : ''}`} />
        <StatCard icon={ArrowUpRight} label="Ingresos totales" value={fmtMoney(totalIngresos)} tone="green" />
        <StatCard icon={ArrowDownRight} label="Egresos totales" value={fmtMoney(totalEgresos)} tone="red" />
        <StatCard icon={DollarSign} label="Balance" value={fmtMoney(totalIngresos - totalEgresos)} tone={totalIngresos - totalEgresos >= 0 ? 'green' : 'red'} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.length === 0 ? (
          <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl">
            <EmptyState icon={History} text="Todavía no hay aperturas de caja" />
          </div>
        ) : (
          <TableCard
            headers={[
              { label: 'Apertura' },
              { label: 'Cierre' },
              { label: 'Inicial', align: 'right' },
              { label: 'Ingresos', align: 'right' },
              { label: 'Egresos', align: 'right' },
              { label: 'Resultado', align: 'right' },
              { label: 'Estado' },
              { label: '', align: 'right' },
            ]}
          >
            {sessions.map(s => {
              const st = sessionStats(s);
              const abierta = s.status === 'abierta';
              return (
                <tr key={s.id} className="border-t border-gray-700/30 text-gray-300 hover:bg-[#151a26] transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDateTime(s.opened_at)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{s.closed_at ? fmtDateTime(s.closed_at) : '—'}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(s.opening_amount)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{fmtMoney(st.ingresos)}</td>
                  <td className="px-4 py-3 text-right text-red-400">{fmtMoney(st.egresos)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${st.resultado >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {fmtMoney(st.resultado)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      abierta ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-600/30 text-gray-400'
                    }`}>
                      {abierta ? 'Abierta' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetail(s)} className="text-gray-400 hover:text-primary-300 p-1 transition-colors" title="Ver movimientos">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </TableCard>
        )}
      </div>

      {detail && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={() => setDetail(null)}>
          <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary-400" />
                Detalle de Caja
              </h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Apertura', fmtDateTime(detail.opened_at)],
                  ['Cierre', detail.closed_at ? fmtDateTime(detail.closed_at) : 'En curso'],
                  ['Monto inicial', fmtMoney(detail.opening_amount)],
                  ['Resultado', fmtMoney(sessionStats(detail).resultado)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className="text-sm text-white font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-3">
                <p className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">
                  Movimientos ({sessionStats(detail).movs.length})
                </p>
                {sessionStats(detail).movs.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-3">Sin movimientos en este período</p>
                ) : (
                  <div className="space-y-2">
                    {sessionStats(detail).movs.map((m, i) => (
                      <div key={i} className="bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{m.description || '(sin descripción)'}</p>
                          <p className="text-[11px] text-gray-500">
                            {fmtDateTime(m.created_at)} • {m.method}
                          </p>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${m.type === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.type === 'ingreso' ? '+' : '−'}{fmtMoney(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setDetail(null)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Cerrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
