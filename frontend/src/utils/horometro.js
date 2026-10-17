// El horómetro se maneja con un decimal. Se redondea al mostrarlo para que no salgan restos de
// la suma de decimales (como 11620.699999999999) y se ve con puntos de miles: 11.620,7
export const redondearHoro = (n) => Math.round((Number(n) || 0) * 10) / 10;

export const fmtHoro = (n) => (n === null || n === undefined || n === '' ? '—'
    : redondearHoro(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 }));
