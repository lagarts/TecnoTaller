import { fmtMoney } from './utils';

const tones = {
  default: 'text-white',
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-primary-400',
  yellow: 'text-yellow-400'
};

const iconTones = {
  default: 'text-gray-400',
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-primary-400',
  yellow: 'text-yellow-400'
};

export function StatCard({ icon: Icon, label, value, tone = 'default', hint }) {
  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-3.5 flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-[#0f1219] border border-gray-700/50 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-4.5 h-4.5 ${iconTones[tone]}`} style={{ width: 18, height: 18 }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-base font-bold truncate ${tones[tone]}`}>{value}</p>
        {hint && <p className="text-[10px] text-gray-600 truncate">{hint}</p>}
      </div>
    </div>
  );
}

export function ChartCard({ title, legend, children }) {
  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">{title}</p>
        {legend && (
          <div className="flex items-center gap-3">
            {legend.map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`}></span>
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="text-center">
        <Icon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">{text}</p>
      </div>
    </div>
  );
}

export function TableCard({ headers, children }) {
  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#151a26]">
            <tr className="text-gray-400 text-left text-xs uppercase">
              {headers.map(h => (
                <th key={h.label} className={`px-4 py-3 font-medium ${h.align === 'right' ? 'text-right' : ''}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Money({ value, tone }) {
  const t = tone === 'green' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-gray-300';
  return <span className={t}>{fmtMoney(value)}</span>;
}
