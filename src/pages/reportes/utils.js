export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString();

export const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR');

export const fmtDateTime = (d) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

export const inMonth = (dateStr, year, month) => {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
};

export const inYear = (dateStr, year) => new Date(dateStr).getFullYear() === year;

export const METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro'
};

export const METHOD_COLORS = {
  efectivo: { bar: 'bg-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  transferencia: { bar: 'bg-sky-500', text: 'text-sky-400', dot: 'bg-sky-500' },
  tarjeta: { bar: 'bg-violet-500', text: 'text-violet-400', dot: 'bg-violet-500' },
  otro: { bar: 'bg-amber-500', text: 'text-amber-400', dot: 'bg-amber-500' }
};
